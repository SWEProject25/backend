-- Create function to set message index
CREATE OR REPLACE FUNCTION set_message_index()
RETURNS TRIGGER AS $$
BEGIN
    -- Get the next message index from the conversation and set it on the new message
    NEW."messageIndex" := (
        SELECT "nextMessageIndex" 
        FROM "conversations" 
        WHERE id = NEW."conversationId"
    );
    
    -- Increment the nextMessageIndex in the conversation
    UPDATE "conversations" 
    SET "nextMessageIndex" = "nextMessageIndex" + 1 
    WHERE id = NEW."conversationId";
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to run before insert on messages
CREATE TRIGGER trigger_set_message_index
    BEFORE INSERT ON "messages"
    FOR EACH ROW
    EXECUTE FUNCTION set_message_index();
