import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  pgEnum,
  index,
  unique,
} from 'drizzle-orm/pg-core';

// ============================================================
// ENUMS
// ============================================================

export const fuelTypeEnum = pgEnum('fuel_type', [
  'PETROL',
  'DIESEL',
  'ELECTRIC',
  'HYBRID',
  'CNG',
  'LPG',
]);

export const transmissionEnum = pgEnum('transmission_type', [
  'MANUAL',
  'AUTOMATIC',
  'CVT',
]);

export const vehicleStatusEnum = pgEnum('vehicle_status', [
  'ACTIVE',       // Registered and operational
  'INACTIVE',     // Owner deactivated
  'TRANSFERRED',  // Ownership changed
]);

// ============================================================
// VEHICLES TABLE
// ============================================================

export const vehicles = pgTable(
  'vehicles',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // The stable cross-service identifier
    // HMAC-SHA256(VIN.toUpperCase() + ':' + ownerId)
    hash: varchar('hash', { length: 64 }).notNull().unique(),

    // Ownership
    ownerId: uuid('owner_id').notNull(), // References users.id in auth-service DB

    // Vehicle identity
    vin: varchar('vin', { length: 17 }).notNull(),
    licensePlate: varchar('license_plate', { length: 20 }).notNull(),

    // Make / model
    make: varchar('make', { length: 100 }).notNull(),         // e.g. Toyota
    model: varchar('model', { length: 100 }).notNull(),        // e.g. Camry
    year: integer('year').notNull(),
    color: varchar('color', { length: 50 }),
    trim: varchar('trim', { length: 100 }),                   // e.g. "LE", "Sport"

    // Technical specs
    fuelType: fuelTypeEnum('fuel_type').notNull(),
    transmissionType: transmissionEnum('transmission_type').notNull(),
    engineCapacity: varchar('engine_capacity', { length: 20 }), // e.g. "2.0L"
    engineCode: varchar('engine_code', { length: 50 }),

    // Mileage baseline — important for future OBD max-run analysis
    mileageAtRegistration: integer('mileage_at_registration').notNull().default(0),

    // Status
    status: vehicleStatusEnum('status').notNull().default('ACTIVE'),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    // A VIN can be registered under multiple owners (ownership transfer)
    // but only once per owner at a time
    vinOwnerUnique: unique('vehicles_vin_owner_unique').on(table.vin, table.ownerId),
    ownerIdx: index('vehicles_owner_idx').on(table.ownerId),
    hashIdx: index('vehicles_hash_idx').on(table.hash),
    licensePlateIdx: index('vehicles_license_plate_idx').on(table.licensePlate),
  }),
);

// ============================================================
// VEHICLE OWNERSHIP HISTORY
// Keeps a full audit trail when a car changes hands
// ============================================================

export const vehicleOwnershipHistory = pgTable(
  'vehicle_ownership_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicles.id),
    previousOwnerId: uuid('previous_owner_id').notNull(),
    newOwnerId: uuid('new_owner_id').notNull(),
    previousHash: varchar('previous_hash', { length: 64 }).notNull(),
    newHash: varchar('new_hash', { length: 64 }).notNull(),
    mileageAtTransfer: integer('mileage_at_transfer').notNull(),
    transferredAt: timestamp('transferred_at').notNull().defaultNow(),
    notes: varchar('notes', { length: 500 }),
  },
  (table) => ({
    vehicleIdx: index('ownership_history_vehicle_idx').on(table.vehicleId),
  }),
);

// ============================================================
// INFERRED TYPES
// ============================================================

export type Vehicle = typeof vehicles.$inferSelect;
export type NewVehicle = typeof vehicles.$inferInsert;
export type VehicleOwnershipHistory = typeof vehicleOwnershipHistory.$inferSelect;
export type VehicleStatus = 'ACTIVE' | 'INACTIVE' | 'TRANSFERRED';