// ============================================================
// MOTACARE STATIC INSPECTION CHECKLIST
//
// Phase 1: This is a fixed, comprehensive checklist that every
//          inspection starts from. Every item is pre-seeded
//          as NOT_CHECKED when an inspection session opens.
//
// Phase 2: Claude API will generate a dynamic checklist that
//          re-orders and adds items based on the vehicle's
//          make/model/year and reported symptoms.
//
// Design rule: check IDs are snake_case and must be unique
//              across all categories — they're used as stable
//              keys in the DB and future AI prompts.
// ============================================================

export interface ChecklistItem {
  id: string;
  name: string;
  description: string;  // Tells the fixer exactly what to look for
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; // Default severity if failed
}

export interface ChecklistCategory {
  id: string;
  name: string;
  icon: string;         // Used in the frontend
  order: number;        // Display order
  items: ChecklistItem[];
}

export const STATIC_CHECKLIST: ChecklistCategory[] = [
  // ──────────────────────────────────────────────────────────
  // 1. ENGINE
  // ──────────────────────────────────────────────────────────
  {
    id: 'engine',
    name: 'Engine',
    icon: '⚙️',
    order: 1,
    items: [
      {
        id: 'engine_oil_level',
        name: 'Engine Oil Level',
        description: 'Check dipstick. Oil should be between MIN and MAX marks. Look for milky or burnt appearance.',
        severity: 'HIGH',
      },
      {
        id: 'engine_oil_condition',
        name: 'Engine Oil Condition',
        description: 'Rub oil between fingers. Should not be gritty, excessively dark, or smell burnt.',
        severity: 'MEDIUM',
      },
      {
        id: 'engine_coolant_level',
        name: 'Coolant Level',
        description: 'Check reservoir and radiator when cold. Should be between MIN/MAX. Check colour — should not be rusty or oily.',
        severity: 'HIGH',
      },
      {
        id: 'engine_coolant_condition',
        name: 'Coolant Condition',
        description: 'Check for signs of oil contamination (milky appearance) or heavy rust deposits.',
        severity: 'HIGH',
      },
      {
        id: 'engine_belt_condition',
        name: 'Serpentine / Cam Belt Condition',
        description: 'Inspect for cracking, glazing, fraying, or missing teeth. Check belt tension.',
        severity: 'CRITICAL',
      },
      {
        id: 'engine_air_filter',
        name: 'Air Filter',
        description: 'Remove and inspect. Should not be clogged with dust, insects, or debris.',
        severity: 'MEDIUM',
      },
      {
        id: 'engine_leaks',
        name: 'Engine Oil / Fluid Leaks',
        description: 'Inspect under the engine bay and underneath the vehicle for fresh oil, coolant, or other fluid stains.',
        severity: 'HIGH',
      },
      {
        id: 'engine_mounts',
        name: 'Engine Mounts',
        description: 'Check for cracked or collapsed rubber mounts causing excessive engine movement.',
        severity: 'MEDIUM',
      },
      {
        id: 'engine_start_quality',
        name: 'Cold Start Quality',
        description: 'Note how quickly engine fires and whether any rough idling, misfires, or smoke occurs on startup.',
        severity: 'HIGH',
      },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // 2. BRAKES
  // ──────────────────────────────────────────────────────────
  {
    id: 'brakes',
    name: 'Brakes',
    icon: '🛑',
    order: 2,
    items: [
      {
        id: 'brake_fluid_level',
        name: 'Brake Fluid Level',
        description: 'Check reservoir. Low fluid indicates worn pads or a possible leak. Must be between MIN and MAX.',
        severity: 'CRITICAL',
      },
      {
        id: 'brake_fluid_condition',
        name: 'Brake Fluid Condition',
        description: 'Fluid should be clear to light yellow. Dark/cloudy fluid indicates moisture contamination — replace immediately.',
        severity: 'HIGH',
      },
      {
        id: 'brake_pads_front',
        name: 'Front Brake Pad Thickness',
        description: 'Inspect through wheel spokes if possible or remove wheel. Min acceptable thickness: 3mm. Below 2mm is CRITICAL.',
        severity: 'CRITICAL',
      },
      {
        id: 'brake_pads_rear',
        name: 'Rear Brake Pad / Shoe Thickness',
        description: 'Inspect rear pads or drum brake shoes. Same 3mm minimum applies.',
        severity: 'HIGH',
      },
      {
        id: 'brake_discs_front',
        name: 'Front Brake Disc Condition',
        description: 'Look for deep grooves, cracks, or severe scoring. Check for minimum thickness markings on disc edge.',
        severity: 'HIGH',
      },
      {
        id: 'brake_discs_rear',
        name: 'Rear Brake Disc / Drum Condition',
        description: 'Inspect for warping, cracking, or surface rust beyond normal light surface rust.',
        severity: 'MEDIUM',
      },
      {
        id: 'brake_lines',
        name: 'Brake Lines & Hoses',
        description: 'Inspect rubber hoses for cracks, bulges, or chafing. Metal lines should show no corrosion or damage.',
        severity: 'CRITICAL',
      },
      {
        id: 'handbrake_operation',
        name: 'Handbrake / Park Brake Operation',
        description: 'Apply on a slight incline. Should hold vehicle with 4–7 clicks. Check cable condition.',
        severity: 'MEDIUM',
      },
      {
        id: 'brake_pedal_feel',
        name: 'Brake Pedal Feel',
        description: 'Pedal should be firm and responsive. Spongy pedal indicates air in lines or a failing master cylinder.',
        severity: 'CRITICAL',
      },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // 3. TYRES & WHEELS
  // ──────────────────────────────────────────────────────────
  {
    id: 'tyres',
    name: 'Tyres & Wheels',
    icon: '🔄',
    order: 3,
    items: [
      {
        id: 'tyre_tread_depth',
        name: 'Tyre Tread Depth (all 4)',
        description: 'Legal minimum: 1.6mm. Recommended replacement: 3mm. Check using tread wear indicators in the grooves.',
        severity: 'HIGH',
      },
      {
        id: 'tyre_pressure',
        name: 'Tyre Pressure (all 4)',
        description: 'Check cold pressure against door placard spec. Include spare if applicable.',
        severity: 'MEDIUM',
      },
      {
        id: 'tyre_condition',
        name: 'Tyre Sidewall & Surface Condition',
        description: 'Inspect for cracks, bulges, embedded objects, or uneven wear patterns indicating alignment or suspension issues.',
        severity: 'HIGH',
      },
      {
        id: 'wheel_balance',
        name: 'Wheel Balance Indicators',
        description: 'Check for steering vibration at speed and uneven wear patterns that suggest balance issues.',
        severity: 'LOW',
      },
      {
        id: 'wheel_nuts_torque',
        name: 'Wheel Nut Torque',
        description: 'Check all wheel nuts are present and tight to manufacturer spec. Look for signs of previous cross-threading.',
        severity: 'CRITICAL',
      },
      {
        id: 'spare_tyre',
        name: 'Spare Tyre Condition',
        description: 'Check spare tyre pressure and condition. Confirm jack and brace are present and accessible.',
        severity: 'LOW',
      },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // 4. ELECTRICAL
  // ──────────────────────────────────────────────────────────
  {
    id: 'electrical',
    name: 'Electrical',
    icon: '⚡',
    order: 4,
    items: [
      {
        id: 'battery_condition',
        name: 'Battery Condition & Terminals',
        description: 'Check voltage (12.6V+ at rest). Inspect terminals for corrosion. Check hold-down bracket.',
        severity: 'HIGH',
      },
      {
        id: 'battery_age',
        name: 'Battery Age',
        description: 'Check manufacture date on label. Most batteries last 3–5 years. Flag if over 4 years old.',
        severity: 'MEDIUM',
      },
      {
        id: 'alternator_charging',
        name: 'Alternator Charging Voltage',
        description: 'With engine running, battery should read 13.8–14.4V. Outside this range indicates alternator issue.',
        severity: 'HIGH',
      },
      {
        id: 'lights_headlights',
        name: 'Headlights (Main & Dipped)',
        description: 'Test both main beam and dipped beam on all units. Check alignment and lens condition.',
        severity: 'HIGH',
      },
      {
        id: 'lights_indicators',
        name: 'Indicators & Hazard Lights',
        description: 'Test all four corners plus hazard function. Rapid flashing can indicate a failed bulb.',
        severity: 'MEDIUM',
      },
      {
        id: 'lights_brake',
        name: 'Brake Lights (all)',
        description: 'Test all brake light positions including high-level third brake light. Requires assistant or mirror check.',
        severity: 'HIGH',
      },
      {
        id: 'lights_reverse',
        name: 'Reverse & Fog Lights',
        description: 'Engage reverse gear to test reverse lights. Test rear fog lamp operation.',
        severity: 'LOW',
      },
      {
        id: 'dashboard_warning_lights',
        name: 'Dashboard Warning Lights',
        description: 'Start engine and note any persistent warning lights. Document any lit codes for OBD scan.',
        severity: 'HIGH',
      },
      {
        id: 'horn',
        name: 'Horn',
        description: 'Test horn operation. Check for weak sound indicating wiring or relay issue.',
        severity: 'LOW',
      },
      {
        id: 'wipers_washers',
        name: 'Wipers & Washers',
        description: 'Test all wiper speeds and washer jets. Inspect blade condition for smearing or skipping.',
        severity: 'MEDIUM',
      },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // 5. FLUIDS
  // ──────────────────────────────────────────────────────────
  {
    id: 'fluids',
    name: 'Fluids',
    icon: '💧',
    order: 5,
    items: [
      {
        id: 'power_steering_fluid',
        name: 'Power Steering Fluid',
        description: 'Check level and condition in reservoir. Low level with no leaks can indicate internal seal wear.',
        severity: 'MEDIUM',
      },
      {
        id: 'transmission_fluid',
        name: 'Transmission / Gearbox Fluid',
        description: 'Check level and condition (automatic: dipstick; manual: fill plug). Should not smell burnt.',
        severity: 'HIGH',
      },
      {
        id: 'windscreen_washer_fluid',
        name: 'Windscreen Washer Fluid',
        description: 'Check level. Top up if needed. Ensure correct dilution for local climate.',
        severity: 'LOW',
      },
      {
        id: 'differential_fluid',
        name: 'Differential Fluid (if applicable)',
        description: 'Check front and rear differential fluid on 4WD/AWD vehicles. Look for metallic contamination.',
        severity: 'MEDIUM',
      },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // 6. TRANSMISSION & DRIVETRAIN
  // ──────────────────────────────────────────────────────────
  {
    id: 'transmission',
    name: 'Transmission & Drivetrain',
    icon: '🔧',
    order: 6,
    items: [
      {
        id: 'gearbox_operation',
        name: 'Gearbox Operation',
        description: 'Test all gear selections including reverse. Note any grinding, jumping out of gear, or resistance.',
        severity: 'HIGH',
      },
      {
        id: 'clutch_operation',
        name: 'Clutch Operation (manual)',
        description: 'Check clutch bite point, pedal free play, and full engagement. Note any slipping or judder.',
        severity: 'HIGH',
      },
      {
        id: 'cv_joints',
        name: 'CV Joint Boots',
        description: 'Inspect rubber boots on driveshafts for splits or grease leakage. Failed boots lead to joint failure.',
        severity: 'HIGH',
      },
      {
        id: 'driveshaft_condition',
        name: 'Driveshaft Condition',
        description: 'Check for play, vibration under load, or clicking sounds during tight turns.',
        severity: 'HIGH',
      },
      {
        id: 'transfer_case',
        name: 'Transfer Case (4WD/AWD)',
        description: 'Test 4WD engagement. Check for leaks and unusual noises during operation.',
        severity: 'MEDIUM',
      },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // 7. BODY & CHASSIS
  // ──────────────────────────────────────────────────────────
  {
    id: 'body',
    name: 'Body & Chassis',
    icon: '🚘',
    order: 7,
    items: [
      {
        id: 'body_rust',
        name: 'Body & Chassis Rust / Corrosion',
        description: 'Inspect sills, wheel arches, underside, and chassis rails for structural rust. Surface rust is low severity; bubbling or structural rust is critical.',
        severity: 'HIGH',
      },
      {
        id: 'body_panel_condition',
        name: 'Panel Condition',
        description: 'Note any accident damage, dents, or misaligned panels suggesting prior collision.',
        severity: 'LOW',
      },
      {
        id: 'doors_locks',
        name: 'Doors, Locks & Hinges',
        description: 'Test all doors open, close, and lock/unlock properly. Check for sagging hinges or broken strikers.',
        severity: 'LOW',
      },
      {
        id: 'windscreen_glass',
        name: 'Windscreen & Glass',
        description: 'Check windscreen for chips or cracks in the driver\'s line of sight. Inspect all windows for cracks.',
        severity: 'MEDIUM',
      },
      {
        id: 'suspension_visual',
        name: 'Suspension Components (visual)',
        description: 'Inspect shock absorbers for leaks, control arm bushings for wear, and anti-roll bar links for damage.',
        severity: 'HIGH',
      },
      {
        id: 'steering_play',
        name: 'Steering Play & Column',
        description: 'Check for excessive steering wheel play (>30mm). Inspect column for correct alignment and no looseness.',
        severity: 'HIGH',
      },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // 8. EXHAUST & EMISSIONS
  // ──────────────────────────────────────────────────────────
  {
    id: 'exhaust',
    name: 'Exhaust & Emissions',
    icon: '💨',
    order: 8,
    items: [
      {
        id: 'exhaust_smoke_colour',
        name: 'Exhaust Smoke Colour',
        description: 'Blue smoke = burning oil. White smoke = coolant/water. Black smoke = rich fuel mixture. Brief white on cold start is normal.',
        severity: 'HIGH',
      },
      {
        id: 'exhaust_system_condition',
        name: 'Exhaust System Condition',
        description: 'Inspect from manifold to tail pipe for cracks, holes, and loose mountings. Listen for ticking or blowing.',
        severity: 'MEDIUM',
      },
      {
        id: 'catalytic_converter',
        name: 'Catalytic Converter',
        description: 'Check for rattling (internal breakdown) or damage from ground impact. Confirm it has not been removed.',
        severity: 'HIGH',
      },
      {
        id: 'exhaust_leaks',
        name: 'Exhaust Leaks',
        description: 'With engine warm, listen and feel (carefully) for exhaust gas escaping before the tail pipe. Black soot marks indicate leak points.',
        severity: 'HIGH',
      },
    ],
  },
];

// ============================================================
// HELPER — builds a flat list of all check IDs for validation
// ============================================================

export const ALL_CHECK_IDS = STATIC_CHECKLIST.flatMap((cat) =>
  cat.items.map((item) => item.id),
);

export const CHECK_ID_TO_CATEGORY = STATIC_CHECKLIST.reduce<Record<string, string>>(
  (acc, cat) => {
    cat.items.forEach((item) => {
      acc[item.id] = cat.id;
    });
    return acc;
  },
  {},
);

// ============================================================
// HELPER — generate a fresh empty inspection item set
// Called when a new inspection session is created
// ============================================================

export function buildInitialInspectionItems(inspectionId: string) {
  return STATIC_CHECKLIST.flatMap((category) =>
    category.items.map((item) => ({
      inspectionId,
      category: category.id,
      checkId: item.id,
      checkName: item.name,
      status: 'NOT_CHECKED' as const,
      severity: null,
      notes: null,
      mediaUrls: [],
    })),
  );
}

// ============================================================
// STATS HELPER — used in inspection summary generation
// ============================================================

export interface ChecklistStats {
  total: number;
  passed: number;
  failed: number;
  warnings: number;
  notChecked: number;
  criticalFails: string[];
}

export function computeChecklistStats(
  items: Array<{ status: string; severity: string | null; checkName: string }>,
): ChecklistStats {
  const stats: ChecklistStats = {
    total: items.length,
    passed: 0,
    failed: 0,
    warnings: 0,
    notChecked: 0,
    criticalFails: [],
  };

  for (const item of items) {
    switch (item.status) {
      case 'PASS':
        stats.passed++;
        break;
      case 'FAIL':
        stats.failed++;
        if (item.severity === 'CRITICAL') {
          stats.criticalFails.push(item.checkName);
        }
        break;
      case 'WARNING':
        stats.warnings++;
        break;
      default:
        stats.notChecked++;
    }
  }

  return stats;
}