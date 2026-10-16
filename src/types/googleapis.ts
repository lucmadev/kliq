/** Stand-in for the generated Google client types.

The real `googleapis` package is hundreds of megabytes of declarations and
was exhausting the TypeScript server. Runtime imports still resolve to the
package in node_modules; only the type checker follows the tsconfig path.
*/
type Thumb = { url?: string | null };

type VideoItem = {
  id?: string | null;
  snippet?: {
    title?: string | null;
    publishedAt?: string | null;
    thumbnails?: { default?: Thumb | null; medium?: Thumb | null } | null;
  } | null;
  statistics?: {
    subscriberCount?: string | null;
    viewCount?: string | null;
    videoCount?: string | null;
    likeCount?: string | null;
    commentCount?: string | null;
  } | null;
  contentDetails?: {
    duration?: string | null;
    videoId?: string | null;
    relatedPlaylists?: { uploads?: string | null } | null;
  } | null;
};

type ListResponse = {
  data: {
    items?: VideoItem[] | null;
    nextPageToken?: string | null;
    columnHeaders?: { name?: string | null }[];
    rows?: unknown[][] | null;
  };
};

export const google = {
  youtube(_opts: { version: "v3"; auth: unknown }) {
    return {
      channels: { list: (_query: object): Promise<ListResponse> => Promise.resolve({ data: {} }) },
      playlistItems: { list: (_query: object): Promise<ListResponse> => Promise.resolve({ data: {} }) },
      videos: { list: (_query: object): Promise<ListResponse> => Promise.resolve({ data: {} }) },
    };
  },
  youtubeAnalytics(_opts: { version: "v2"; auth: unknown }) {
    return {
      reports: {
        query: (_query: object): Promise<ListResponse> => Promise.resolve({ data: {} }),
      },
    };
  },
};
