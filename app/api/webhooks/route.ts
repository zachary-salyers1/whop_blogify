import { waitUntil } from "@vercel/functions";
import { makeWebhookValidator } from "@whop/api";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const validateWebhook = makeWebhookValidator({
	webhookSecret: process.env.WHOP_WEBHOOK_SECRET ?? "fallback",
});

export async function POST(request: NextRequest): Promise<Response> {
	try {
		// Validate the webhook to ensure it's from Whop
		const webhookData = await validateWebhook(request);

		// Log webhook event for debugging
		await prisma.webhookEvent.create({
			data: {
				eventType: webhookData.action,
				eventId: webhookData.data?.id ?? undefined,
				payload: webhookData as any,
			},
		});

		// Handle different webhook events
		waitUntil(handleWebhookEvent(webhookData));

		// Make sure to return a 2xx status code quickly. Otherwise the webhook will be retried.
		return new Response("OK", { status: 200 });
	} catch (error) {
		console.error("Webhook error:", error);
		// Still return 200 to prevent retries for invalid webhooks
		return new Response("OK", { status: 200 });
	}
}

async function handleWebhookEvent(webhookData: any) {
	try {
		const action = webhookData.action;

		switch (action) {
			case "payment_succeeded":
				await handlePaymentSucceeded(webhookData.data);
				break;

			case "membership_activated":
				await handleMembershipActivated(webhookData.data);
				break;

			case "membership_deactivated":
				await handleMembershipDeactivated(webhookData.data);
				break;

			default:
				console.log(`Unhandled webhook event: ${action}`);
		}

		// Mark webhook as processed
		await prisma.webhookEvent.updateMany({
			where: {
				eventId: webhookData.data?.id,
			},
			data: {
				processed: true,
				processedAt: new Date(),
			},
		});
	} catch (error) {
		console.error("Error handling webhook event:", error);

		// Mark webhook as failed
		await prisma.webhookEvent.updateMany({
			where: {
				eventId: webhookData.data?.id,
			},
			data: {
				error: error instanceof Error ? error.message : "Unknown error",
				retryCount: {
					increment: 1,
				},
			},
		});
	}
}

async function handlePaymentSucceeded(data: any) {
	const userId = data.user_id;
	const companyId = data.company_id;

	console.log(`Payment succeeded for user ${userId} in company ${companyId}`);

	// Create or update user
	if (userId) {
		await prisma.user.upsert({
			where: { id: userId },
			create: {
				id: userId,
			},
			update: {},
		});
	}
}

async function handleMembershipActivated(data: any) {
	const userId = data.user?.id;
	const companyId = data.company_id;
	const membershipId = data.id;
	const expiresAt = data.expires_at ? new Date(data.expires_at * 1000) : null;

	if (!userId || !companyId) {
		console.error("Missing userId or companyId in membership activation");
		return;
	}

	// Create or update user
	await prisma.user.upsert({
		where: { id: userId },
		create: {
			id: userId,
			email: data.user?.email,
			username: data.user?.username,
		},
		update: {
			email: data.user?.email,
			username: data.user?.username,
		},
	});

	// Create or update company
	await prisma.company.upsert({
		where: { id: companyId },
		create: {
			id: companyId,
			name: data.company?.name ?? "Unknown Company",
			experienceId: data.experience_id ?? companyId,
			isActive: true,
		},
		update: {
			name: data.company?.name ?? undefined,
			experienceId: data.experience_id ?? undefined,
			isActive: true,
		},
	});

	console.log(`Upserted company: ${companyId} (${data.company?.name}) with experience ${data.experience_id}`);

	// Grant access
	await prisma.userCompany.upsert({
		where: {
			unique_user_company: {
				userId,
				companyId,
			},
		},
		create: {
			userId,
			companyId,
			membershipId,
			hasAccess: true,
			role: "member",
			expiresAt,
		},
		update: {
			hasAccess: true,
			membershipId,
			lastVerified: new Date(),
			expiresAt,
		},
	});

	console.log(`Granted access for user ${userId} to company ${companyId}`);
}

async function handleMembershipDeactivated(data: any) {
	const userId = data.user?.id;
	const companyId = data.company_id;

	if (!userId || !companyId) {
		console.error("Missing userId or companyId in membership deactivation");
		return;
	}

	// Revoke access
	await prisma.userCompany.updateMany({
		where: {
			userId,
			companyId,
		},
		data: {
			hasAccess: false,
			lastVerified: new Date(),
		},
	});

	console.log(`Revoked access for user ${userId} from company ${companyId}`);
}
