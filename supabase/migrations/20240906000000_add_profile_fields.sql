-- Add additional profile fields for artist profiles
ALTER TABLE profiles 
ADD COLUMN bio text,
ADD COLUMN location text,
ADD COLUMN website text;
