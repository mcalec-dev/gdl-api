import sync from '../utils/file/sync.js'

const { initializeDatabaseSync } = sync

export default async function syncFilesystemToDatabase() {
	await initializeDatabaseSync()
}
