-- CreateExtension
CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateEnum
CREATE TYPE "account_status" AS ENUM ('pending_email_verification', 'active', 'suspended', 'banned', 'deleted');

-- CreateEnum
CREATE TYPE "onboarding_status" AS ENUM ('not_started', 'in_progress', 'completed');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('user', 'moderator', 'admin');

-- CreateEnum
CREATE TYPE "auth_provider" AS ENUM ('email', 'google');

-- CreateEnum
CREATE TYPE "session_status" AS ENUM ('active', 'revoked', 'expired', 'compromised');

-- CreateEnum
CREATE TYPE "security_token_type" AS ENUM ('email_verification', 'password_reset', 'account_restore');

-- CreateEnum
CREATE TYPE "gender" AS ENUM ('male', 'female', 'non_binary', 'other');

-- CreateEnum
CREATE TYPE "relationship_goal" AS ENUM ('long_term', 'short_term', 'friends', 'still_figuring_out');

-- CreateEnum
CREATE TYPE "upload_status" AS ENUM ('pending', 'uploaded', 'confirmed', 'expired');

-- CreateEnum
CREATE TYPE "moderation_status" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "active_location_mode" AS ENUM ('real', 'passport');

-- CreateEnum
CREATE TYPE "swipe_action" AS ENUM ('like', 'pass', 'super_like', 'rewind');

-- CreateEnum
CREATE TYPE "swipe_event_status" AS ENUM ('active', 'reverted', 'ignored');

-- CreateEnum
CREATE TYPE "current_swipe_action" AS ENUM ('like', 'pass', 'super_like');

-- CreateEnum
CREATE TYPE "match_status" AS ENUM ('active', 'unmatched', 'blocked');

-- CreateEnum
CREATE TYPE "message_type" AS ENUM ('text', 'image', 'system');

-- CreateEnum
CREATE TYPE "message_status" AS ENUM ('sent', 'deleted_by_sender', 'removed_by_moderation');

-- CreateEnum
CREATE TYPE "block_status" AS ENUM ('active', 'revoked');

-- CreateEnum
CREATE TYPE "report_target_type" AS ENUM ('user', 'profile', 'photo', 'message', 'match');

-- CreateEnum
CREATE TYPE "report_status" AS ENUM ('pending', 'reviewing', 'resolved', 'dismissed');

-- CreateEnum
CREATE TYPE "payment_provider" AS ENUM ('vnpay');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('pending', 'paid', 'failed', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "payment_purpose" AS ENUM ('subscription_purchase');

-- CreateEnum
CREATE TYPE "subscription_provider" AS ENUM ('vnpay', 'manual');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('active', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "entitlement_type" AS ENUM ('unlimited_likes', 'see_who_liked_me', 'rewind', 'passport', 'super_like_quota', 'hidden_mode');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('match_created', 'new_message', 'super_like_received', 'profile_approved', 'payment_success', 'subscription_expiring', 'moderation_update', 'system');

-- CreateEnum
CREATE TYPE "notification_delivery_status" AS ENUM ('pending', 'delivered', 'failed');

-- CreateEnum
CREATE TYPE "outbox_status" AS ENUM ('pending', 'processing', 'processed', 'failed', 'dead');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "email_normalized" VARCHAR(320) NOT NULL,
    "email_verified_at" TIMESTAMPTZ,
    "account_status" "account_status" NOT NULL DEFAULT 'pending_email_verification',
    "onboarding_status" "onboarding_status" NOT NULL DEFAULT 'not_started',
    "user_role" "user_role" NOT NULL DEFAULT 'user',
    "last_login_at" TIMESTAMPTZ,
    "onboarding_completed_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,
    "deletion_scheduled_at" TIMESTAMPTZ,
    "anonymized_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_identities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "auth_provider" NOT NULL,
    "provider_user_id" VARCHAR(320) NOT NULL,
    "password_hash" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "auth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "refresh_token_family_id" UUID NOT NULL,
    "session_status" "session_status" NOT NULL DEFAULT 'active',
    "user_agent" TEXT,
    "ip_hash" TEXT,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "last_used_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,
    "revoked_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_type" "security_token_type" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata_json" JSONB,

    CONSTRAINT "security_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "display_name" VARCHAR(80) NOT NULL,
    "dob" DATE NOT NULL,
    "gender" "gender" NOT NULL,
    "bio" VARCHAR(500),
    "job_title" VARCHAR(120),
    "company" VARCHAR(120),
    "school" VARCHAR(120),
    "height_cm" INTEGER,
    "relationship_goal" "relationship_goal" NOT NULL,
    "lifestyle_json" JSONB,
    "interests_json" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_photos" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "storage_provider" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "public_url" TEXT,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "is_avatar" BOOLEAN NOT NULL DEFAULT false,
    "upload_status" "upload_status" NOT NULL DEFAULT 'pending',
    "moderation_status" "moderation_status" NOT NULL DEFAULT 'pending',
    "rejection_reason" TEXT,
    "approved_at" TIMESTAMPTZ,
    "rejected_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "profile_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_locations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "real_location" geography(Point,4326),
    "passport_location" geography(Point,4326),
    "active_location_mode" "active_location_mode" NOT NULL DEFAULT 'real',
    "accuracy_meters" INTEGER,
    "is_mocked" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovery_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "min_age" INTEGER NOT NULL,
    "max_age" INTEGER NOT NULL,
    "max_distance_km" INTEGER NOT NULL,
    "preferred_genders" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "discovery_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_privacy_settings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "show_distance" BOOLEAN NOT NULL DEFAULT true,
    "show_online_status" BOOLEAN NOT NULL DEFAULT true,
    "show_last_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_privacy_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "swipe_events" (
    "id" UUID NOT NULL,
    "swiper_id" UUID NOT NULL,
    "target_user_id" UUID NOT NULL,
    "action" "swipe_action" NOT NULL,
    "message" VARCHAR(500),
    "status" "swipe_event_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reverted_at" TIMESTAMPTZ,
    "reverted_by_event_id" UUID,

    CONSTRAINT "swipe_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "swipe_states" (
    "swiper_id" UUID NOT NULL,
    "target_user_id" UUID NOT NULL,
    "current_action" "current_swipe_action" NOT NULL,
    "last_swipe_event_id" UUID NOT NULL,
    "last_swiped_at" TIMESTAMPTZ NOT NULL,
    "recycle_after_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "swipe_states_pkey" PRIMARY KEY ("swiper_id","target_user_id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" UUID NOT NULL,
    "user_a_id" UUID NOT NULL,
    "user_b_id" UUID NOT NULL,
    "status" "match_status" NOT NULL DEFAULT 'active',
    "matched_at" TIMESTAMPTZ,
    "unmatched_at" TIMESTAMPTZ,
    "unmatched_by_user_id" UUID,
    "blocked_by_user_id" UUID,
    "last_message_at" TIMESTAMPTZ,
    "last_interaction_at" TIMESTAMPTZ,
    "unread_count_a" INTEGER NOT NULL DEFAULT 0,
    "unread_count_b" INTEGER NOT NULL DEFAULT 0,
    "last_read_message_id_a" UUID,
    "last_read_message_id_b" UUID,
    "last_read_at_a" TIMESTAMPTZ,
    "last_read_at_b" TIMESTAMPTZ,
    "created_from_swipe_event_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "message_type" "message_type" NOT NULL,
    "body" TEXT,
    "media_url" TEXT,
    "status" "message_status" NOT NULL DEFAULT 'sent',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_blocks" (
    "id" UUID NOT NULL,
    "blocker_id" UUID NOT NULL,
    "blocked_user_id" UUID NOT NULL,
    "status" "block_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_reports" (
    "id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "reported_user_id" UUID NOT NULL,
    "target_type" "report_target_type" NOT NULL,
    "target_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "status" "report_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ,
    "resolved_by_admin_id" UUID,
    "resolution_note" TEXT,

    CONSTRAINT "user_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_orders" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "payment_provider" NOT NULL DEFAULT 'vnpay',
    "order_code" VARCHAR(100) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "payment_status" "payment_status" NOT NULL DEFAULT 'pending',
    "purpose" "payment_purpose" NOT NULL DEFAULT 'subscription_purchase',
    "plan_code" VARCHAR(50) NOT NULL,
    "provider_order_ref" TEXT,
    "provider_transaction_no" TEXT,
    "provider_response_code" TEXT,
    "provider_payload_json" JSONB,
    "paid_at" TIMESTAMPTZ,
    "expired_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "payment_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "payment_order_id" UUID,
    "provider" "subscription_provider" NOT NULL,
    "plan_code" VARCHAR(50) NOT NULL,
    "status" "subscription_status" NOT NULL DEFAULT 'active',
    "current_period_start" TIMESTAMPTZ NOT NULL,
    "current_period_end" TIMESTAMPTZ NOT NULL,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_entitlements" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "subscription_id" UUID,
    "entitlement_type" "entitlement_type" NOT NULL,
    "quantity" INTEGER,
    "window_start" TIMESTAMPTZ,
    "window_end" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "notification_type" NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "body" VARCHAR(500),
    "payload_json" JSONB,
    "delivery_status" "notification_delivery_status" NOT NULL DEFAULT 'pending',
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" UUID,
    "metadata_json" JSONB,
    "ip_hash" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "status" "outbox_status" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ,
    "failed_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_normalized_key" ON "users"("email_normalized");

-- CreateIndex
CREATE INDEX "idx_users_account_status" ON "users"("account_status");

-- CreateIndex
CREATE INDEX "idx_users_onboarding_status" ON "users"("onboarding_status");

-- CreateIndex
CREATE INDEX "idx_users_deleted_at" ON "users"("deleted_at");

-- CreateIndex
CREATE INDEX "idx_users_deletion_scheduled_at" ON "users"("deletion_scheduled_at");

-- CreateIndex
CREATE INDEX "idx_auth_identities_user_id" ON "auth_identities"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_auth_identities_provider_user_id" ON "auth_identities"("provider", "provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_auth_identities_user_provider" ON "auth_identities"("user_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_refresh_token_hash_key" ON "user_sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "idx_user_sessions_user_status" ON "user_sessions"("user_id", "session_status");

-- CreateIndex
CREATE INDEX "idx_user_sessions_refresh_family" ON "user_sessions"("refresh_token_family_id");

-- CreateIndex
CREATE INDEX "idx_user_sessions_expires_at" ON "user_sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "security_tokens_token_hash_key" ON "security_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "idx_security_tokens_user_type" ON "security_tokens"("user_id", "token_type");

-- CreateIndex
CREATE INDEX "idx_security_tokens_expires_at" ON "security_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "idx_security_tokens_token_hash" ON "security_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_user_id_key" ON "profiles"("user_id");

-- CreateIndex
CREATE INDEX "idx_profiles_user_id" ON "profiles"("user_id");

-- CreateIndex
CREATE INDEX "idx_profiles_gender" ON "profiles"("gender");

-- CreateIndex
CREATE INDEX "idx_profiles_dob" ON "profiles"("dob");

-- CreateIndex
CREATE INDEX "idx_profile_photos_user_order" ON "profile_photos"("user_id", "sort_order");

-- CreateIndex
CREATE INDEX "idx_profile_photos_user_moderation" ON "profile_photos"("user_id", "moderation_status");

-- CreateIndex
CREATE INDEX "idx_profile_photos_deleted_at" ON "profile_photos"("deleted_at");

CREATE UNIQUE INDEX IF NOT EXISTS uq_profile_photos_user_sort_active
ON profile_photos(user_id, sort_order)
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_profile_photos_user_avatar_active
ON profile_photos(user_id)
WHERE is_avatar = true AND deleted_at IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "user_locations_user_id_key" ON "user_locations"("user_id");

-- CreateIndex
CREATE INDEX "idx_user_locations_user_id" ON "user_locations"("user_id");

CREATE INDEX IF NOT EXISTS idx_user_locations_real_gist
ON user_locations
USING GIST (real_location);

CREATE INDEX IF NOT EXISTS idx_user_locations_passport_gist
ON user_locations
USING GIST (passport_location);

-- CreateIndex
CREATE UNIQUE INDEX "discovery_preferences_user_id_key" ON "discovery_preferences"("user_id");

-- CreateIndex
CREATE INDEX "idx_discovery_preferences_user_id" ON "discovery_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_privacy_settings_user_id_key" ON "user_privacy_settings"("user_id");

-- CreateIndex
CREATE INDEX "idx_user_privacy_settings_user_id" ON "user_privacy_settings"("user_id");

-- CreateIndex
CREATE INDEX "idx_user_privacy_settings_is_hidden" ON "user_privacy_settings"("is_hidden");

-- CreateIndex
CREATE INDEX "idx_swipe_events_swiper_target_created" ON "swipe_events"("swiper_id", "target_user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_swipe_events_target_action_created" ON "swipe_events"("target_user_id", "action", "created_at");

-- CreateIndex
CREATE INDEX "idx_swipe_events_swiper_action_created" ON "swipe_events"("swiper_id", "action", "created_at");

-- CreateIndex
CREATE INDEX "idx_swipe_states_swiper_action" ON "swipe_states"("swiper_id", "current_action");

-- CreateIndex
CREATE INDEX "idx_swipe_states_target_action" ON "swipe_states"("target_user_id", "current_action");

-- CreateIndex
CREATE INDEX "idx_swipe_states_recycle_after" ON "swipe_states"("recycle_after_at");

-- CreateIndex
CREATE INDEX "idx_matches_user_a_status" ON "matches"("user_a_id", "status");

-- CreateIndex
CREATE INDEX "idx_matches_user_b_status" ON "matches"("user_b_id", "status");

-- CreateIndex
CREATE INDEX "idx_matches_last_message_at" ON "matches"("last_message_at");

-- CreateIndex
CREATE INDEX "idx_matches_status" ON "matches"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_matches_user_pair" ON "matches"("user_a_id", "user_b_id");

-- CreateIndex
CREATE INDEX "idx_messages_match_created" ON "messages"("match_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_messages_sender_created" ON "messages"("sender_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_messages_status" ON "messages"("status");

-- CreateIndex
CREATE INDEX "idx_user_blocks_blocker_status" ON "user_blocks"("blocker_id", "status");

-- CreateIndex
CREATE INDEX "idx_user_blocks_blocked_status" ON "user_blocks"("blocked_user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_user_blocks_pair" ON "user_blocks"("blocker_id", "blocked_user_id");

-- CreateIndex
CREATE INDEX "idx_user_reports_reported_status" ON "user_reports"("reported_user_id", "status");

-- CreateIndex
CREATE INDEX "idx_user_reports_reporter_created" ON "user_reports"("reporter_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_user_reports_status_created" ON "user_reports"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_orders_order_code_key" ON "payment_orders"("order_code");

-- CreateIndex
CREATE INDEX "idx_payment_orders_user_created" ON "payment_orders"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_payment_orders_status_created" ON "payment_orders"("payment_status", "created_at");

-- CreateIndex
CREATE INDEX "idx_payment_orders_provider_tx" ON "payment_orders"("provider_transaction_no");

-- CreateIndex
CREATE INDEX "idx_user_subscriptions_user_status" ON "user_subscriptions"("user_id", "status");

-- CreateIndex
CREATE INDEX "idx_user_subscriptions_period_end" ON "user_subscriptions"("current_period_end");

-- CreateIndex
CREATE INDEX "idx_user_subscriptions_payment_order" ON "user_subscriptions"("payment_order_id");

-- CreateIndex
CREATE INDEX "idx_user_entitlements_user_type_expiry" ON "user_entitlements"("user_id", "entitlement_type", "expires_at");

-- CreateIndex
CREATE INDEX "idx_user_entitlements_subscription" ON "user_entitlements"("subscription_id");

-- CreateIndex
CREATE INDEX "idx_notifications_user_created" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_notifications_user_read" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "idx_notifications_expires_at" ON "notifications"("expires_at");

-- CreateIndex
CREATE INDEX "idx_audit_logs_actor_created" ON "audit_logs"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_audit_logs_target" ON "audit_logs"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "idx_audit_logs_action_created" ON "audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "idx_outbox_events_status_available" ON "outbox_events"("status", "available_at");

-- CreateIndex
CREATE INDEX "idx_outbox_events_type_status" ON "outbox_events"("event_type", "status");

-- CreateIndex
CREATE INDEX "idx_outbox_events_aggregate" ON "outbox_events"("aggregate_type", "aggregate_id");

-- AddForeignKey
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_tokens" ADD CONSTRAINT "security_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_photos" ADD CONSTRAINT "profile_photos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_locations" ADD CONSTRAINT "user_locations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovery_preferences" ADD CONSTRAINT "discovery_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_privacy_settings" ADD CONSTRAINT "user_privacy_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swipe_events" ADD CONSTRAINT "swipe_events_swiper_id_fkey" FOREIGN KEY ("swiper_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swipe_events" ADD CONSTRAINT "swipe_events_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swipe_events" ADD CONSTRAINT "swipe_events_reverted_by_event_id_fkey" FOREIGN KEY ("reverted_by_event_id") REFERENCES "swipe_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swipe_states" ADD CONSTRAINT "swipe_states_swiper_id_fkey" FOREIGN KEY ("swiper_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swipe_states" ADD CONSTRAINT "swipe_states_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swipe_states" ADD CONSTRAINT "swipe_states_last_swipe_event_id_fkey" FOREIGN KEY ("last_swipe_event_id") REFERENCES "swipe_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_user_a_id_fkey" FOREIGN KEY ("user_a_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_user_b_id_fkey" FOREIGN KEY ("user_b_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_unmatched_by_user_id_fkey" FOREIGN KEY ("unmatched_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_blocked_by_user_id_fkey" FOREIGN KEY ("blocked_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_created_from_swipe_event_id_fkey" FOREIGN KEY ("created_from_swipe_event_id") REFERENCES "swipe_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_user_id_fkey" FOREIGN KEY ("blocked_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reported_user_id_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_resolved_by_admin_id_fkey" FOREIGN KEY ("resolved_by_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_payment_order_id_fkey" FOREIGN KEY ("payment_order_id") REFERENCES "payment_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_entitlements" ADD CONSTRAINT "user_entitlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_entitlements" ADD CONSTRAINT "user_entitlements_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "user_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE auth_identities
ADD CONSTRAINT chk_auth_identities_password_provider
CHECK (
  (provider = 'email' AND password_hash IS NOT NULL)
  OR
  (provider = 'google' AND password_hash IS NULL)
);

ALTER TABLE profiles
ADD CONSTRAINT chk_profiles_height_cm
CHECK (height_cm IS NULL OR (height_cm BETWEEN 100 AND 250));

ALTER TABLE profile_photos
ADD CONSTRAINT chk_profile_photos_size_bytes
CHECK (size_bytes > 0);

ALTER TABLE profile_photos
ADD CONSTRAINT chk_profile_photos_sort_order
CHECK (sort_order > 0);

ALTER TABLE discovery_preferences
ADD CONSTRAINT chk_discovery_preferences_age
CHECK (min_age >= 18 AND max_age >= min_age);

ALTER TABLE discovery_preferences
ADD CONSTRAINT chk_discovery_preferences_distance
CHECK (max_distance_km > 0);

ALTER TABLE user_locations
ADD CONSTRAINT chk_user_locations_accuracy_meters
CHECK (accuracy_meters IS NULL OR accuracy_meters >= 0);

ALTER TABLE swipe_events
ADD CONSTRAINT chk_swipe_events_not_self
CHECK (swiper_id <> target_user_id);

ALTER TABLE swipe_states
ADD CONSTRAINT chk_swipe_states_not_self
CHECK (swiper_id <> target_user_id);

ALTER TABLE matches
ADD CONSTRAINT chk_matches_not_self
CHECK (user_a_id <> user_b_id);

ALTER TABLE matches
ADD CONSTRAINT chk_matches_pair_order
CHECK (user_a_id < user_b_id);

ALTER TABLE matches
ADD CONSTRAINT chk_matches_unread_counts
CHECK (unread_count_a >= 0 AND unread_count_b >= 0);

ALTER TABLE messages
ADD CONSTRAINT chk_messages_text_body
CHECK (
  (message_type = 'text' AND body IS NOT NULL)
  OR message_type <> 'text'
);

ALTER TABLE messages
ADD CONSTRAINT chk_messages_image_media_url
CHECK (
  (message_type = 'image' AND media_url IS NOT NULL)
  OR message_type <> 'image'
);

ALTER TABLE user_blocks
ADD CONSTRAINT chk_user_blocks_not_self
CHECK (blocker_id <> blocked_user_id);

ALTER TABLE user_reports
ADD CONSTRAINT chk_user_reports_not_self
CHECK (reporter_id <> reported_user_id);

ALTER TABLE payment_orders
ADD CONSTRAINT chk_payment_orders_amount
CHECK (amount > 0);

ALTER TABLE user_subscriptions
ADD CONSTRAINT chk_user_subscriptions_period
CHECK (current_period_end > current_period_start);

ALTER TABLE user_entitlements
ADD CONSTRAINT chk_user_entitlements_quantity
CHECK (quantity IS NULL OR quantity >= 0);

ALTER TABLE user_entitlements
ADD CONSTRAINT chk_user_entitlements_window
CHECK (
  window_end IS NULL
  OR (window_start IS NOT NULL AND window_end > window_start)
);

ALTER TABLE outbox_events
ADD CONSTRAINT chk_outbox_events_attempts
CHECK (attempts >= 0);
