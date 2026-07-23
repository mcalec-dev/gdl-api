/** @param {string} str */
function escapeRegexString(str) {
  if (typeof str !== 'string') return ''
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** @param {string} q @param {string} type */
function buildQueries(q, type) {
  const escapedQuery = escapeRegexString(q)
  const fileQuery =
    type === 'directory'
      ? null
      : type === 'uuid'
        ? { uuid: { $eq: q } }
        : type === 'hash'
          ? { hash: { $regex: escapedQuery, $options: 'i' } }
          : {
              $or: [
                { name: { $regex: escapedQuery, $options: 'i' } },
                { 'paths.relative': { $regex: escapedQuery, $options: 'i' } },
                { collection: { $regex: escapedQuery, $options: 'i' } },
                { author: { $regex: escapedQuery, $options: 'i' } },
                { tags: { $regex: escapedQuery, $options: 'i' } },
                // sidecar — post content (field name varies by extractor)
                { 'sidecar.title': { $regex: escapedQuery, $options: 'i' } },
                {
                  'sidecar.description': {
                    $regex: escapedQuery,
                    $options: 'i',
                  },
                },
                { 'sidecar.text': { $regex: escapedQuery, $options: 'i' } }, // Twitter/Bluesky
                { 'sidecar.caption': { $regex: escapedQuery, $options: 'i' } }, // Instagram
                { 'sidecar.desc': { $regex: escapedQuery, $options: 'i' } }, // TikTok
                { 'sidecar.body': { $regex: escapedQuery, $options: 'i' } }, // Tumblr/Patreon
                { 'sidecar.summary': { $regex: escapedQuery, $options: 'i' } },
                // sidecar — alternate title-like fields
                { 'sidecar.name': { $regex: escapedQuery, $options: 'i' } }, // Toyhouse character names
                {
                  'sidecar.comic_name': { $regex: escapedQuery, $options: 'i' },
                },
                {
                  'sidecar.episode_name': {
                    $regex: escapedQuery,
                    $options: 'i',
                  },
                },
                {
                  'sidecar.music.title': {
                    $regex: escapedQuery,
                    $options: 'i',
                  },
                }, // TikTok
                // sidecar — flat author/creator fields
                { 'sidecar.username': { $regex: escapedQuery, $options: 'i' } },
                {
                  'sidecar.author_name': {
                    $regex: escapedQuery,
                    $options: 'i',
                  },
                },
                { 'sidecar.artist': { $regex: escapedQuery, $options: 'i' } }, // FA/DA
                { 'sidecar.fullname': { $regex: escapedQuery, $options: 'i' } }, // DA
                {
                  'sidecar.blog_name': { $regex: escapedQuery, $options: 'i' },
                }, // Tumblr
                // sidecar — nested author object (Bluesky, TikTok, Misskey)
                {
                  'sidecar.author.name': {
                    $regex: escapedQuery,
                    $options: 'i',
                  },
                },
                {
                  'sidecar.author.nick': {
                    $regex: escapedQuery,
                    $options: 'i',
                  },
                },
                {
                  'sidecar.author.handle': {
                    $regex: escapedQuery,
                    $options: 'i',
                  },
                },
                {
                  'sidecar.author.displayName': {
                    $regex: escapedQuery,
                    $options: 'i',
                  },
                },
                // sidecar — nested user object (Twitter, Instagram)
                {
                  'sidecar.user.name': { $regex: escapedQuery, $options: 'i' },
                },
                {
                  'sidecar.user.nick': { $regex: escapedQuery, $options: 'i' },
                },
                {
                  'sidecar.user.username': {
                    $regex: escapedQuery,
                    $options: 'i',
                  },
                },
                {
                  'sidecar.user.full_name': {
                    $regex: escapedQuery,
                    $options: 'i',
                  },
                },
                // sidecar — nested blog/board (Tumblr, Pinterest)
                {
                  'sidecar.blog.name': { $regex: escapedQuery, $options: 'i' },
                },
                {
                  'sidecar.blog.title': { $regex: escapedQuery, $options: 'i' },
                },
                {
                  'sidecar.board.name': { $regex: escapedQuery, $options: 'i' },
                },
                // sidecar — extractor-specific category fields
                { 'sidecar.genre': { $regex: escapedQuery, $options: 'i' } },
                { 'sidecar.species': { $regex: escapedQuery, $options: 'i' } },
                {
                  'sidecar.fa_category': {
                    $regex: escapedQuery,
                    $options: 'i',
                  },
                },
                { 'sidecar.rating': { $regex: escapedQuery, $options: 'i' } },
                {
                  'sidecar.search_tags': {
                    $regex: escapedQuery,
                    $options: 'i',
                  },
                }, // DA tag string
                // meta
                { 'meta.format': { $regex: escapedQuery, $options: 'i' } },
                { 'meta.space': { $regex: escapedQuery, $options: 'i' } },
                { 'meta.xmpAsString': { $regex: escapedQuery, $options: 'i' } },
                ...(type === 'all'
                  ? [
                      { uuid: { $eq: q } },
                      { hash: { $regex: escapedQuery, $options: 'i' } },
                    ]
                  : []),
              ],
            }
  const dirQuery =
    type === 'uuid' || type === 'hash'
      ? null
      : {
          $or: [
            { name: { $regex: escapedQuery, $options: 'i' } },
            { 'paths.relative': { $regex: escapedQuery, $options: 'i' } },
            { tags: { $regex: escapedQuery, $options: 'i' } },
          ],
        }
  return {
    fileQuery,
    dirQuery,
  }
}

module.exports = {
  escapeRegexString,
  buildQueries,
}
