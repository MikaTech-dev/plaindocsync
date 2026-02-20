import { createClient } from "@liveblocks/client";

const client = createClient({
    publicApiKey: import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY as string,
});

export { client };
