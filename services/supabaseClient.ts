import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jykmdkvudzwctbdqlftw.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5a21ka3Z1ZHp3Y3RiZHFsZnR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5MzY0NTksImV4cCI6MjA3NzUxMjQ1OX0.EZAUixOZgyPyqIRqX_PyJsBSGQN9swQG1ic3SJYeS-g'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)