export type UserRole = "student" | "admin";

export type Profile = {
  id: string;
  full_name: string | null;
  email: string;
  role: UserRole;
  created_at?: string;
  updated_at?: string;
};

export type Building = {
  id: string;
  name: string;
  description?: string | null;
  location: string | null;
  created_at?: string;
};

export type Zone = {
  id: string;
  building_id?: string;
  name: string;
  floor_number: number;
  description?: string | null;
  building?: Building;
};

export type SpaceType =
  | "Library"
  | "Quiet Zone"
  | "Group Room"
  | "Computer Lab"
  | "Individual Desk"
  | "Collaborative Zone";

export type SpaceStatus = "available" | "maintenance" | "closed";

export type StudySpace = {
  id: string;
  building_id?: string | null;
  zone_id?: string | null;
  name: string;
  description?: string | null;
  space_type: SpaceType;
  capacity: number;
  image_url: string | null;
  opening_time: string;
  closing_time: string;
  status: SpaceStatus;
  facilities: string[];
  created_at?: string;
  // Augmented properties
  building?: Building | null;
  zone?: Zone | null;
  location?: string;
  available_seats_count?: number;
  total_seats_count?: number;
};

export type SeatType = "standard" | "standing" | "window" | "power_accessible" | "group";
export type SeatStatus = "available" | "maintenance" | "blocked";

export type Seat = {
  id: string;
  space_id: string;
  seat_number: string;
  seat_type: SeatType;
  status: SeatStatus;
  row_label?: string | null;
  column_number?: number | null;
  // Dynamic occupancy state for a time window:
  // "available" | "selected" | "reserved" | "occupied" | "unavailable"
  computed_state?: "available" | "reserved" | "occupied" | "unavailable";
};

export type BookingStatus =
  | "confirmed"
  | "checked_in"
  | "completed"
  | "cancelled"
  | "no_show"
  | "expired";

export type Booking = {
  id: string;
  user_id: string;
  seat_id: string;
  space_id: string;
  start_at: string;
  end_at: string;
  status: BookingStatus;
  created_at: string;
  updated_at?: string;
  // Augmented relations
  space?: StudySpace;
  seat?: Seat;
  user?: Profile;
};

export type OccupancyEventType =
  | "check_in"
  | "check_out"
  | "auto_checkout"
  | "no_show_cancellation"
  | "manual_override";

export type OccupancyLog = {
  id: string;
  seat_id: string;
  user_id: string;
  booking_id?: string | null;
  event_type: OccupancyEventType;
  occurred_at: string;
  metadata?: Record<string, unknown>;
  user?: Profile;
  seat?: Seat;
};

export type UsageRule = {
  id: string;
  space_id: string;
  max_booking_duration_minutes: number;
  advance_booking_limit_days: number;
  cancellation_limit_minutes: number;
  check_in_window_minutes: number;
};

export type AdminAnalytics = {
  totalBuildings: number;
  totalSpaces: number;
  totalSeats: number;
  currentlyAvailableSeats: number;
  currentlyOccupiedSeats: number;
  activeReservationsCount: number;
  dailyBookingsCount: number;
  weeklyUtilisationRate: number;
  dailyTrend: { date: string; bookings: number; checkIns: number }[];
  spaceUtilisation: { name: string; capacity: number; bookings: number; utilisationRate: number }[];
  peakOccupancyHours: { hour: string; activeCount: number }[];
};
