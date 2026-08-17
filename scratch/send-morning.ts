import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

import { postDailyMorningPostToChannel } from '../lib/backend/channel-poster';

async function testSend() {
  console.log('Sending morning post to channel @zerph_off...');
  const res = await postDailyMorningPostToChannel('@zerph_off');
  console.log('Morning post send result:', res);
}

testSend().catch(console.error);
