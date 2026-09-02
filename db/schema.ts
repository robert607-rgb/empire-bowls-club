import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const empireMembers = sqliteTable("empire_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  dateOfBirth: text("date_of_birth"),
  address: text("address").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  membershipType: text("membership_type", {
    enum: ["Full member", "Social member"],
  }).notNull(),
  createdAt: text("created_at").notNull(),
});

export const empireBookings = sqliteTable(
  "empire_bookings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bookingDate: text("booking_date").notNull(),
    rinkNumber: integer("rink_number").notNull(),
    timeSlot: text("time_slot").notNull(),
    bookingName: text("booking_name").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("empire_bookings_slot_unique").on(
      table.bookingDate,
      table.rinkNumber,
      table.timeSlot,
    ),
  ],
);

export const empireUploads = sqliteTable("empire_uploads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  category: text("category", {
    enum: ["team_sheet", "club_document", "players_required"],
  }).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  fileName: text("file_name").notNull(),
  objectKey: text("object_key").notNull(),
  contentType: text("content_type").notNull(),
  createdAt: text("created_at").notNull(),
});

export const empireNews = sqliteTable("empire_news", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  body: text("body").notNull(),
  category: text("category").notNull(),
  accent: text("accent").notNull(),
  emoji: text("emoji").notNull(),
  publishedAt: text("published_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const empireNewsAssets = sqliteTable("empire_news_assets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  newsId: integer("news_id").notNull().unique(),
  objectKey: text("object_key").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  createdAt: text("created_at").notNull(),
});
