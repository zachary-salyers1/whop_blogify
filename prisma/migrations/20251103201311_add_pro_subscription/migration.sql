-- CreateTable
CREATE TABLE "pro_subscriptions" (
    "id" BIGSERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "whop_membership_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "canceled_at" TIMESTAMP(3),

    CONSTRAINT "pro_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pro_subscriptions_user_id_status_idx" ON "pro_subscriptions"("user_id", "status");

-- CreateIndex
CREATE INDEX "pro_subscriptions_whop_membership_id_idx" ON "pro_subscriptions"("whop_membership_id");

-- CreateIndex
CREATE INDEX "pro_subscriptions_current_period_end_idx" ON "pro_subscriptions"("current_period_end");
