INSERT INTO classes (name) VALUES
  ('Baby Class'), ('Middle Class'), ('Reception'), ('Grade 1'), ('Grade 2'),
  ('Grade 3'), ('Grade 4'), ('Grade 5'), ('Form 1')
ON CONFLICT (name) DO NOTHING;
