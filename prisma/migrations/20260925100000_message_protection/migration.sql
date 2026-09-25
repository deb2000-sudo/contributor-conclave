-- Message bodies for SERVER protection are encrypted by the application before insert.
-- E2EE is reserved so a later client-side scheme can store opaque ciphertext in the same column.
CREATE TYPE "MessageProtection" AS ENUM ('SERVER', 'E2EE');

ALTER TABLE "messages"
  ADD COLUMN "protection" "MessageProtection" NOT NULL DEFAULT 'SERVER';

CREATE INDEX "messages_sender_id_created_at_idx" ON "messages"("sender_id", "created_at");
