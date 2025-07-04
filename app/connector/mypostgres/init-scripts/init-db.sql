-- Create the primary database and tables
\c primary;

-- Create the table in the primary database
CREATE TABLE IF NOT EXISTS "table" (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

-- Insert some sample data into the primary database
INSERT INTO "table" (name) VALUES 
  ('Primary Record 1'),
  ('Primary Record 2'),
  ('Primary Record 3');

-- Create follower databases
CREATE DATABASE follower1;
CREATE DATABASE follower2;
CREATE DATABASE follower3;

-- Connect to follower1 and create the same schema
\c follower1;

CREATE TABLE IF NOT EXISTS "table" (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

-- Insert some sample data into follower1
INSERT INTO "table" (name) VALUES 
  ('Follower1 Record 1'),
  ('Follower1 Record 2'),
  ('Follower1 Record 3');

-- Connect to follower2 and create the same schema
\c follower2;

CREATE TABLE IF NOT EXISTS "table" (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

-- Insert some sample data into follower2
INSERT INTO "table" (name) VALUES 
  ('Follower2 Record 1'),
  ('Follower2 Record 2'),
  ('Follower2 Record 3');

-- Connect to follower3 and create the same schema
\c follower3;

CREATE TABLE IF NOT EXISTS "table" (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

-- Insert some sample data into follower3
INSERT INTO "table" (name) VALUES 
  ('Follower3 Record 1'),
  ('Follower3 Record 2'),
  ('Follower3 Record 3');

