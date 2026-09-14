CREATE TABLE `gallery_export` (
	`position` integer PRIMARY KEY NOT NULL,
	`photo_id` text NOT NULL,
	`src` text NOT NULL,
	`title` text NOT NULL,
	`story` text NOT NULL,
	`note` text NOT NULL,
	`date` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `gallery_export` (`position`, `photo_id`, `src`, `title`, `story`, `note`, `date`)
SELECT
	CAST(photo.key AS INTEGER),
	json_extract(photo.value, '$.id'),
	json_extract(photo.value, '$.src'),
	json_extract(photo.value, '$.title'),
	json_extract(photo.value, '$.story'),
	json_extract(photo.value, '$.note'),
	json_extract(photo.value, '$.date')
FROM `gallery_state`, json_each(`gallery_state`.`photos_json`) AS photo
WHERE `gallery_state`.`id` = 1;
