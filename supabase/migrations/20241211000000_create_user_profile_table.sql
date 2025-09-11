-- Create user_profile table for customizable user details
CREATE TABLE user_profile (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    bio TEXT,
    location TEXT,
    website TEXT,
    social_links JSONB DEFAULT '{}',
    profile_banner_url TEXT,
    profile_theme TEXT DEFAULT 'default',
    privacy_settings JSONB DEFAULT '{
        "profile_visibility": "public",
        "show_activity": true,
        "show_playlists": true,
        "allow_messages": true
    }',
    notification_preferences JSONB DEFAULT '{
        "email_notifications": true,
        "push_notifications": true,
        "karaoke_invites": true,
        "new_followers": true,
        "song_recommendations": true
    }',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one profile per user
    UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX idx_user_profile_user_id ON user_profile(user_id);

-- Enable RLS
ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own profile" ON user_profile
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON user_profile
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON user_profile
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own profile" ON user_profile
    FOR DELETE USING (auth.uid() = user_id);

-- Public profiles are viewable by everyone
CREATE POLICY "Public profiles are viewable" ON user_profile
    FOR SELECT USING (
        (privacy_settings->>'profile_visibility')::text = 'public'
    );

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_profile (user_id, display_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', NEW.email)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION create_user_profile();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on profile changes
CREATE TRIGGER update_user_profile_updated_at_trigger
    BEFORE UPDATE ON user_profile
    FOR EACH ROW EXECUTE FUNCTION update_user_profile_updated_at();
