// ============================================================
// STATIC CHECKLIST REFERENCE FOR AI CLIENT
// A lightweight copy of the checklist structure used as
// the base reference when prompting Claude.
// The full implementation lives in inspection-service.
// ============================================================

export interface ChecklistItem {
  id: string;
  name: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface ChecklistCategory {
  id: string;
  name: string;
  icon: string;
  order: number;
  items: ChecklistItem[];
}

// Minimal static checklist — just enough for the AI prompt context
// Full checklist with all descriptions lives in inspection-service/checklist.ts
export const STATIC_CHECKLIST: ChecklistCategory[] = [
  {
    id: 'engine', name: 'Engine', icon: '⚙️', order: 1,
    items: [
      { id: 'engine_oil_level', name: 'Engine Oil Level', description: 'Check dipstick MIN/MAX marks, look for milky or burnt oil', severity: 'HIGH' },
      { id: 'engine_oil_condition', name: 'Engine Oil Condition', description: 'Check for gritty, excessively dark, or burnt-smelling oil', severity: 'MEDIUM' },
      { id: 'engine_coolant_level', name: 'Coolant Level', description: 'Check reservoir between MIN/MAX when cold', severity: 'HIGH' },
      { id: 'engine_coolant_condition', name: 'Coolant Condition', description: 'Check for oil contamination or rust deposits', severity: 'HIGH' },
      { id: 'engine_belt_condition', name: 'Belt Condition', description: 'Inspect for cracking, fraying, or missing teeth', severity: 'CRITICAL' },
      { id: 'engine_air_filter', name: 'Air Filter', description: 'Check for clogging with dust or debris', severity: 'MEDIUM' },
      { id: 'engine_leaks', name: 'Fluid Leaks', description: 'Inspect underneath for fresh oil or coolant stains', severity: 'HIGH' },
      { id: 'engine_mounts', name: 'Engine Mounts', description: 'Check for cracked or collapsed rubber mounts', severity: 'MEDIUM' },
      { id: 'engine_start_quality', name: 'Cold Start Quality', description: 'Note rough idling, misfires, or smoke on startup', severity: 'HIGH' },
    ],
  },
  {
    id: 'brakes', name: 'Brakes', icon: '🛑', order: 2,
    items: [
      { id: 'brake_fluid_level', name: 'Brake Fluid Level', description: 'Check reservoir MIN/MAX', severity: 'CRITICAL' },
      { id: 'brake_fluid_condition', name: 'Brake Fluid Condition', description: 'Dark/cloudy = moisture contamination', severity: 'HIGH' },
      { id: 'brake_pads_front', name: 'Front Brake Pads', description: 'Min 3mm thickness', severity: 'CRITICAL' },
      { id: 'brake_pads_rear', name: 'Rear Brake Pads/Shoes', description: 'Min 3mm thickness', severity: 'HIGH' },
      { id: 'brake_discs_front', name: 'Front Discs', description: 'Check for grooves, cracks, or minimum thickness', severity: 'HIGH' },
      { id: 'brake_discs_rear', name: 'Rear Discs/Drums', description: 'Check for warping or cracking', severity: 'MEDIUM' },
      { id: 'brake_lines', name: 'Brake Lines & Hoses', description: 'Inspect for cracks, bulges, or corrosion', severity: 'CRITICAL' },
      { id: 'handbrake_operation', name: 'Handbrake', description: '4-7 clicks, holds on incline', severity: 'MEDIUM' },
      { id: 'brake_pedal_feel', name: 'Brake Pedal Feel', description: 'Firm and responsive — spongy = air in lines', severity: 'CRITICAL' },
    ],
  },
  {
    id: 'tyres', name: 'Tyres & Wheels', icon: '🔄', order: 3,
    items: [
      { id: 'tyre_tread_depth', name: 'Tread Depth (all 4)', description: 'Legal min 1.6mm, replace at 3mm', severity: 'HIGH' },
      { id: 'tyre_pressure', name: 'Tyre Pressure', description: 'Check cold vs door placard spec', severity: 'MEDIUM' },
      { id: 'tyre_condition', name: 'Tyre Condition', description: 'Check for cracks, bulges, uneven wear', severity: 'HIGH' },
      { id: 'wheel_balance', name: 'Wheel Balance', description: 'Check for vibration at speed', severity: 'LOW' },
      { id: 'wheel_nuts_torque', name: 'Wheel Nut Torque', description: 'All present and torqued to spec', severity: 'CRITICAL' },
      { id: 'spare_tyre', name: 'Spare Tyre', description: 'Pressure and condition, jack present', severity: 'LOW' },
    ],
  },
  {
    id: 'electrical', name: 'Electrical', icon: '⚡', order: 4,
    items: [
      { id: 'battery_condition', name: 'Battery & Terminals', description: 'Check voltage 12.6V+, clean terminals', severity: 'HIGH' },
      { id: 'battery_age', name: 'Battery Age', description: 'Flag if over 4 years old', severity: 'MEDIUM' },
      { id: 'alternator_charging', name: 'Alternator Voltage', description: '13.8-14.4V with engine running', severity: 'HIGH' },
      { id: 'lights_headlights', name: 'Headlights', description: 'Test main and dipped beam', severity: 'HIGH' },
      { id: 'lights_indicators', name: 'Indicators & Hazards', description: 'Test all four corners', severity: 'MEDIUM' },
      { id: 'lights_brake', name: 'Brake Lights', description: 'All positions including high-level', severity: 'HIGH' },
      { id: 'lights_reverse', name: 'Reverse & Fog Lights', description: 'Test operation', severity: 'LOW' },
      { id: 'dashboard_warning_lights', name: 'Warning Lights', description: 'Note any persistent lights', severity: 'HIGH' },
      { id: 'horn', name: 'Horn', description: 'Test operation', severity: 'LOW' },
      { id: 'wipers_washers', name: 'Wipers & Washers', description: 'All speeds and jets', severity: 'MEDIUM' },
    ],
  },
  {
    id: 'fluids', name: 'Fluids', icon: '💧', order: 5,
    items: [
      { id: 'power_steering_fluid', name: 'Power Steering Fluid', description: 'Check level and condition', severity: 'MEDIUM' },
      { id: 'transmission_fluid', name: 'Transmission Fluid', description: 'Check level, should not smell burnt', severity: 'HIGH' },
      { id: 'windscreen_washer_fluid', name: 'Washer Fluid', description: 'Check and top up', severity: 'LOW' },
      { id: 'differential_fluid', name: 'Differential Fluid', description: '4WD/AWD vehicles only', severity: 'MEDIUM' },
    ],
  },
  {
    id: 'transmission', name: 'Transmission & Drivetrain', icon: '🔧', order: 6,
    items: [
      { id: 'gearbox_operation', name: 'Gearbox Operation', description: 'Test all gears including reverse', severity: 'HIGH' },
      { id: 'clutch_operation', name: 'Clutch Operation', description: 'Bite point, free play, full engagement', severity: 'HIGH' },
      { id: 'cv_joints', name: 'CV Joint Boots', description: 'Inspect for splits or grease leakage', severity: 'HIGH' },
      { id: 'driveshaft_condition', name: 'Driveshaft Condition', description: 'Check for play or clicking turns', severity: 'HIGH' },
      { id: 'transfer_case', name: 'Transfer Case', description: '4WD/AWD only — test engagement', severity: 'MEDIUM' },
    ],
  },
  {
    id: 'body', name: 'Body & Chassis', icon: '🚘', order: 7,
    items: [
      { id: 'body_rust', name: 'Rust & Corrosion', description: 'Sills, wheel arches, chassis rails', severity: 'HIGH' },
      { id: 'body_panel_condition', name: 'Panel Condition', description: 'Accident damage, misaligned panels', severity: 'LOW' },
      { id: 'doors_locks', name: 'Doors & Locks', description: 'All doors open, close, lock correctly', severity: 'LOW' },
      { id: 'windscreen_glass', name: 'Windscreen & Glass', description: 'Chips or cracks in driver sightline', severity: 'MEDIUM' },
      { id: 'suspension_visual', name: 'Suspension (visual)', description: 'Shocks, control arms, anti-roll links', severity: 'HIGH' },
      { id: 'steering_play', name: 'Steering Play', description: 'Max 30mm play at wheel', severity: 'HIGH' },
    ],
  },
  {
    id: 'exhaust', name: 'Exhaust & Emissions', icon: '💨', order: 8,
    items: [
      { id: 'exhaust_smoke_colour', name: 'Exhaust Smoke Colour', description: 'Blue=oil, white=coolant, black=rich mixture', severity: 'HIGH' },
      { id: 'exhaust_system_condition', name: 'Exhaust Condition', description: 'Cracks, holes, loose mountings', severity: 'MEDIUM' },
      { id: 'catalytic_converter', name: 'Catalytic Converter', description: 'Check for rattling or damage', severity: 'HIGH' },
      { id: 'exhaust_leaks', name: 'Exhaust Leaks', description: 'Listen for blowing, check soot marks', severity: 'HIGH' },
    ],
  },
];