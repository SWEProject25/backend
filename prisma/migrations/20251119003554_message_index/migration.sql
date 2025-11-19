-- AlterTable: Add messageIndex column to messages if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'messageIndex'
    ) THEN
        ALTER TABLE "messages" ADD COLUMN "messageIndex" INTEGER;
    END IF;
END $$;

-- AlterTable: Add nextMessageIndex column to conversations if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'conversations' AND column_name = 'nextMessageIndex'
    ) THEN
        ALTER TABLE "conversations" ADD COLUMN "nextMessageIndex" INTEGER NOT NULL DEFAULT 1;
    END IF;
END $$;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS set_message_index ON "messages";

-- Drop function if exists
DROP FUNCTION IF EXISTS assign_message_index();

-- Create function for auto-incrementing message index
CREATE OR REPLACE FUNCTION assign_message_index()
RETURNS TRIGGER AS $$
DECLARE
    idx INT;
BEGIN
    -- Atomically increase nextMessageIndex and return old value
    UPDATE "conversations"
    SET "nextMessageIndex" = "nextMessageIndex" + 1
    WHERE id = NEW."conversationId"
    RETURNING "nextMessageIndex" - 1 INTO idx;

    NEW."messageIndex" = idx;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER set_message_index
BEFORE INSERT ON "messages"
FOR EACH ROW
EXECUTE FUNCTION assign_message_index();
