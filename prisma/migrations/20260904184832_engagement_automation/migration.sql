-- CreateTable
CREATE TABLE "sequence_step_automations" (
    "id" TEXT NOT NULL,
    "sequence_step_id" TEXT NOT NULL,
    "trigger_type" TEXT NOT NULL,
    "trigger_delay_hours" INTEGER NOT NULL,
    "action_template_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sequence_step_automations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_follow_ups" (
    "id" TEXT NOT NULL,
    "automation_rule_id" TEXT NOT NULL,
    "trigger_email_send_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "provider_message_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "automation_follow_ups_automation_rule_id_trigger_email_send_key" ON "automation_follow_ups"("automation_rule_id", "trigger_email_send_id");

-- AddForeignKey
ALTER TABLE "sequence_step_automations" ADD CONSTRAINT "sequence_step_automations_sequence_step_id_fkey" FOREIGN KEY ("sequence_step_id") REFERENCES "sequence_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequence_step_automations" ADD CONSTRAINT "sequence_step_automations_action_template_id_fkey" FOREIGN KEY ("action_template_id") REFERENCES "templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_follow_ups" ADD CONSTRAINT "automation_follow_ups_automation_rule_id_fkey" FOREIGN KEY ("automation_rule_id") REFERENCES "sequence_step_automations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_follow_ups" ADD CONSTRAINT "automation_follow_ups_trigger_email_send_id_fkey" FOREIGN KEY ("trigger_email_send_id") REFERENCES "email_sends"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
