-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "title" TEXT,
    "company" TEXT,
    "phone" TEXT,
    "domain" TEXT,
    "location_raw" TEXT,
    "resolved_timezone" TEXT,
    "industry" TEXT,
    "email" TEXT NOT NULL,
    "custom_fields" JSONB,
    "is_suppressed" BOOLEAN NOT NULL DEFAULT false,
    "source_row_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_lists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_list_members" (
    "id" TEXT NOT NULL,
    "contact_list_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,

    CONSTRAINT "contact_list_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body_html" TEXT NOT NULL,
    "body_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sending_rules" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequence_steps" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "step_order" INTEGER NOT NULL,
    "template_id" TEXT NOT NULL,
    "delay_days" INTEGER NOT NULL DEFAULT 0,
    "delay_hours" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sequence_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_contacts" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "current_step_id" TEXT,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_send_queue" (
    "id" TEXT NOT NULL,
    "campaign_contact_id" TEXT NOT NULL,
    "sequence_step_id" TEXT NOT NULL,
    "target_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_review',

    CONSTRAINT "daily_send_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_sends" (
    "id" TEXT NOT NULL,
    "campaign_contact_id" TEXT NOT NULL,
    "sequence_step_id" TEXT NOT NULL,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "current_status" TEXT NOT NULL DEFAULT 'queued',
    "provider_message_id" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "email_sends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_events" (
    "id" TEXT NOT NULL,
    "email_send_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_data" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppression_list" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppression_list_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contacts_email_key" ON "contacts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "contact_list_members_contact_list_id_contact_id_key" ON "contact_list_members"("contact_list_id", "contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "sequence_steps_campaign_id_step_order_key" ON "sequence_steps"("campaign_id", "step_order");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_contacts_campaign_id_contact_id_key" ON "campaign_contacts"("campaign_id", "contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_sends_campaign_contact_id_sequence_step_id_key" ON "email_sends"("campaign_contact_id", "sequence_step_id");

-- CreateIndex
CREATE UNIQUE INDEX "suppression_list_email_key" ON "suppression_list"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "contact_list_members" ADD CONSTRAINT "contact_list_members_contact_list_id_fkey" FOREIGN KEY ("contact_list_id") REFERENCES "contact_lists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_list_members" ADD CONSTRAINT "contact_list_members_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequence_steps" ADD CONSTRAINT "sequence_steps_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequence_steps" ADD CONSTRAINT "sequence_steps_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_contacts" ADD CONSTRAINT "campaign_contacts_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_contacts" ADD CONSTRAINT "campaign_contacts_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_send_queue" ADD CONSTRAINT "daily_send_queue_campaign_contact_id_fkey" FOREIGN KEY ("campaign_contact_id") REFERENCES "campaign_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_send_queue" ADD CONSTRAINT "daily_send_queue_sequence_step_id_fkey" FOREIGN KEY ("sequence_step_id") REFERENCES "sequence_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_campaign_contact_id_fkey" FOREIGN KEY ("campaign_contact_id") REFERENCES "campaign_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_sequence_step_id_fkey" FOREIGN KEY ("sequence_step_id") REFERENCES "sequence_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_email_send_id_fkey" FOREIGN KEY ("email_send_id") REFERENCES "email_sends"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
