import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const galleryState = sqliteTable('gallery_state', {
  id: integer('id').primaryKey(),
  photosJson: text('photos_json').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
