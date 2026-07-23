/** @param {any} result @param {string} queryStr @param {string} type @param {string} searchType */
function scoreResult(result, queryStr, type, searchType) {
  let score = 0
  const nameLower = (result.name || '').toLowerCase()
  const pathLower = (result.paths?.relative || '').toLowerCase()
  const uuidLower = (result.uuid || '').toLowerCase()
  const hashLower = (result.hash || '').toLowerCase()
  const collectionLower = (result.collection || '').toLowerCase()
  const authorLower = (result.author || '').toLowerCase()
  const tagsLower = Array.isArray(result.tags)
    ? result.tags.join(' ').toLowerCase()
    : ''
  // sidecar content blobs
  const sidecarTitleLower = (result.sidecar?.title || '').toLowerCase()
  const sidecarDescriptionLower = (
    result.sidecar?.description || ''
  ).toLowerCase()
  const sidecarTextLower = (result.sidecar?.text || '').toLowerCase()
  const sidecarCaptionLower = (result.sidecar?.caption || '').toLowerCase()
  const sidecarDescLower = (result.sidecar?.desc || '').toLowerCase()
  const sidecarBodyLower = (result.sidecar?.body || '').toLowerCase()
  const sidecarSummaryLower = (result.sidecar?.summary || '').toLowerCase()
  // sidecar alternate title-like fields
  const sidecarNameLower = (result.sidecar?.name || '').toLowerCase()
  const sidecarComicNameLower = (result.sidecar?.comic_name || '').toLowerCase()
  const sidecarEpisodeNameLower = (
    result.sidecar?.episode_name || ''
  ).toLowerCase()
  const sidecarMusicTitleLower = (
    result.sidecar?.music?.title || ''
  ).toLowerCase()
  // sidecar flat author/creator fields
  const sidecarUsernameLower = (result.sidecar?.username || '').toLowerCase()
  const sidecarAuthorNameLower = (
    result.sidecar?.author_name || ''
  ).toLowerCase()
  const sidecarArtistLower = (result.sidecar?.artist || '').toLowerCase()
  const sidecarFullnameLower = (result.sidecar?.fullname || '').toLowerCase()
  const sidecarBlogNameLower = (result.sidecar?.blog_name || '').toLowerCase()
  // sidecar nested author object — guard: author can be object or missing
  const sidecarAuthorObj =
    result.sidecar?.author && typeof result.sidecar.author === 'object'
      ? result.sidecar.author
      : null
  const sidecarAuthorObjNameLower = (sidecarAuthorObj?.name || '').toLowerCase()
  const sidecarAuthorNickLower = (sidecarAuthorObj?.nick || '').toLowerCase()
  const sidecarAuthorHandleLower = (
    sidecarAuthorObj?.handle || ''
  ).toLowerCase()
  const sidecarAuthorDisplayNameLower = (
    sidecarAuthorObj?.displayName || ''
  ).toLowerCase()
  // sidecar nested user object — guard: user can be string or object
  const sidecarUserObj =
    result.sidecar?.user && typeof result.sidecar.user === 'object'
      ? result.sidecar.user
      : null
  const sidecarUserNameLower = (sidecarUserObj?.name || '').toLowerCase()
  const sidecarUserNickLower = (sidecarUserObj?.nick || '').toLowerCase()
  const sidecarUserUsernameLower = (
    sidecarUserObj?.username || ''
  ).toLowerCase()
  const sidecarUserFullNameLower = (
    sidecarUserObj?.full_name || ''
  ).toLowerCase()
  // sidecar nested blog/board
  const sidecarBlogNameNestedLower = (
    result.sidecar?.blog?.name || ''
  ).toLowerCase()
  const sidecarBlogTitleLower = (
    result.sidecar?.blog?.title || ''
  ).toLowerCase()
  const sidecarBoardNameLower = (
    result.sidecar?.board?.name || ''
  ).toLowerCase()
  // sidecar category-style fields
  const sidecarGenreLower = (result.sidecar?.genre || '').toLowerCase()
  const sidecarSpeciesLower = (result.sidecar?.species || '').toLowerCase()
  const sidecarFaCategoryLower = (
    result.sidecar?.fa_category || ''
  ).toLowerCase()
  const sidecarRatingLower = (result.sidecar?.rating || '').toLowerCase()
  const sidecarSearchTagsLower = (
    result.sidecar?.search_tags || ''
  ).toLowerCase()
  // meta
  const metaFormatLower = (result.meta?.format || '').toLowerCase()
  const metaSpaceLower = (result.meta?.space || '').toLowerCase()
  const metaXmpLower = (result.meta?.xmpAsString || '').toLowerCase()
  if (searchType === 'uuid') {
    if (uuidLower === queryStr) score += 100
    else if (uuidLower.includes(queryStr)) score += 80
  } else if (searchType === 'hash') {
    if (hashLower === queryStr) score += 100
    else if (hashLower.startsWith(queryStr)) score += 80
    else if (hashLower.includes(queryStr)) score += 60
  } else {
    if (nameLower === queryStr) score += 60
    else if (nameLower.startsWith(queryStr)) score += 40
    else if (nameLower.includes(queryStr)) score += 25
    if (pathLower === queryStr) score += 40
    else if (pathLower.startsWith(queryStr)) score += 20
    else if (pathLower.includes(queryStr)) score += 10
    if (collectionLower === queryStr) score += 40
    else if (collectionLower.startsWith(queryStr)) score += 20
    else if (collectionLower.includes(queryStr)) score += 10
    if (authorLower === queryStr) score += 40
    else if (authorLower.startsWith(queryStr)) score += 20
    else if (authorLower.includes(queryStr)) score += 10
    if (tagsLower.includes(queryStr)) score += 20
    if (sidecarTitleLower === queryStr) score += 60
    else if (sidecarTitleLower.startsWith(queryStr)) score += 40
    else if (sidecarTitleLower.includes(queryStr)) score += 25
    if (sidecarDescLower.includes(queryStr)) score += 15
    if (uuidLower === queryStr) score += 50
    else if (uuidLower.includes(queryStr)) score += 30
    if (hashLower === queryStr) score += 50
    else if (hashLower.startsWith(queryStr)) score += 30
    else if (hashLower.includes(queryStr)) score += 15
    // sidecar title — same tier as name
    if (sidecarTitleLower === queryStr) score += 60
    else if (sidecarTitleLower.startsWith(queryStr)) score += 40
    else if (sidecarTitleLower.includes(queryStr)) score += 25
    // sidecar alternate title-like fields
    for (const altTitle of [
      sidecarNameLower,
      sidecarComicNameLower,
      sidecarEpisodeNameLower,
      sidecarMusicTitleLower,
    ]) {
      if (altTitle === queryStr) {
        score += 50
        break
      } else if (altTitle.startsWith(queryStr)) {
        score += 30
        break
      } else if (altTitle.includes(queryStr)) {
        score += 20
        break
      }
    }
    // sidecar content blobs — includes-only, lower weight
    const contentBlobs = [
      sidecarDescriptionLower,
      sidecarTextLower,
      sidecarCaptionLower,
      sidecarDescLower,
      sidecarBodyLower,
      sidecarSummaryLower,
      metaXmpLower,
    ]
    if (contentBlobs.some((b) => b.includes(queryStr))) score += 15
    // sidecar flat author/creator fields — same tier as author
    for (const creator of [
      sidecarUsernameLower,
      sidecarAuthorNameLower,
      sidecarArtistLower,
      sidecarFullnameLower,
    ]) {
      if (creator === queryStr) {
        score += 40
        break
      } else if (creator.startsWith(queryStr)) {
        score += 20
        break
      } else if (creator.includes(queryStr)) {
        score += 10
        break
      }
    }
    // sidecar nested author fields
    for (const creatorNested of [
      sidecarAuthorObjNameLower,
      sidecarAuthorNickLower,
      sidecarAuthorHandleLower,
      sidecarAuthorDisplayNameLower,
    ]) {
      if (creatorNested === queryStr) {
        score += 40
        break
      } else if (creatorNested.startsWith(queryStr)) {
        score += 20
        break
      } else if (creatorNested.includes(queryStr)) {
        score += 10
        break
      }
    }
    // sidecar nested user fields
    for (const userField of [
      sidecarUserNameLower,
      sidecarUserNickLower,
      sidecarUserUsernameLower,
      sidecarUserFullNameLower,
    ]) {
      if (userField === queryStr) {
        score += 40
        break
      } else if (userField.startsWith(queryStr)) {
        score += 20
        break
      } else if (userField.includes(queryStr)) {
        score += 10
        break
      }
    }
    // sidecar blog/board names — same tier as collection
    for (const groupName of [
      sidecarBlogNameLower,
      sidecarBlogNameNestedLower,
      sidecarBlogTitleLower,
      sidecarBoardNameLower,
    ]) {
      if (groupName === queryStr) {
        score += 40
        break
      } else if (groupName.startsWith(queryStr)) {
        score += 20
        break
      } else if (groupName.includes(queryStr)) {
        score += 10
        break
      }
    }
    // sidecar category-style fields
    for (const cat of [
      sidecarGenreLower,
      sidecarSpeciesLower,
      sidecarFaCategoryLower,
      sidecarRatingLower,
    ]) {
      if (cat === queryStr) {
        score += 30
        break
      } else if (cat.startsWith(queryStr)) {
        score += 15
        break
      } else if (cat.includes(queryStr)) {
        score += 8
        break
      }
    }
    if (sidecarSearchTagsLower.includes(queryStr)) score += 20
    // meta format fields — low weight, exact/starts-with only since values are short tokens
    if (metaFormatLower === queryStr || metaSpaceLower === queryStr) score += 20
    else if (
      metaFormatLower.startsWith(queryStr) ||
      metaSpaceLower.startsWith(queryStr)
    )
      score += 10
    if (searchType === 'file' && type === 'file') score += 10
    if (searchType === 'directory' && type === 'directory') score += 10
    if (searchType === 'all') {
      if (uuidLower === queryStr) score += 50
      if (hashLower.includes(queryStr)) score += 30
    }
  }
  if (type === 'file' && nameLower.length <= 3) score -= 10
  if (type === 'directory' && nameLower.length <= 3) score -= 5
  return Math.max(0, score)
}

module.exports = { scoreResult }
