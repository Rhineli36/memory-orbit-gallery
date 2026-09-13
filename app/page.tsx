import Gallery from './gallery';
import { chatGPTSignInPath, getChatGPTUser } from './chatgpt-auth';
import { isGalleryOwner } from './owner';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getChatGPTUser();
  return <Gallery isOwner={isGalleryOwner(user?.email)} signInPath={chatGPTSignInPath('/')} showSignIn={!user} />;
}
