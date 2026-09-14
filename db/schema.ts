import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const galleryState = sqliteTable('gallery_state', {
  id: integer('id').primaryKey(),
  photosJson: text('photos_json').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const galleryExport = sqliteTable('gallery_export', {
  position: integer('position').primaryKey(),
  photoId: text('photo_id').notNull(),
  src: text('src').notNull(),
  title: text('title').notNull(),
  story: text('story').notNull(),
  note: text('note').notNull(),
  date: text('date').notNull(),
});
