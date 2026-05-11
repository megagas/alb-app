import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://jthqwchnplaocgiqazov.supabase.co',
  'sb_publishable_wKgCT6WFd94uevg1R43_EQ_-TTLUzOJ',
  {
    auth: {
      flowType: 'pkce',
    }
  }
)