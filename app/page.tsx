import Gallery from './gallery';
import { chatGPTSignInPath, getChatGPTUser } from './chatgpt-auth';

export const dynamic = 'force-dynamic';

const OWNER_USER_ID = '65dcc69f-6c68-4973-aac5-f9f83d44399c';

export default async function Home() {
  const user = await getChatGPTUser();
  return <Gallery isOwner={user?.userId === OWNER_USER_ID} signInPath={chatGPTSignInPath('/')} showSignIn={!user} />;
}
