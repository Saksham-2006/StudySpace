
export type Space = {
  id: number;
  name: string;
  type: string;
  location: string;
  description: string;
  capacity: number;
  available: number;
  image: string;
  facilities: string[];
};

export const spaces: Space[] = [
  {
    id: 1,
    name: "Central Library",
    type: "Library",
    location: "Academic Block · Ground Floor",
    description:
      "A spacious academic environment for focused individual study.",
    capacity: 40,
    available: 18,
    image:
      "https://images.unsplash.com/photo-1507842217343-583bb7270b66",
    facilities: ["Wi-Fi", "Charging", "Silent zone"],
  },
  {
    id: 2,
    name: "The Quiet Room",
    type: "Quiet Zone",
    location: "Library · Second Floor",
    description:
      "A peaceful environment for uninterrupted concentration.",
    capacity: 20,
    available: 7,
    image:
      "https://images.unsplash.com/photo-1497366754035-f200968a6e72",
    facilities: ["Wi-Fi", "Silent zone"],
  },
  {
    id: 3,
    name: "Collaboration Hub",
    type: "Group Room",
    location: "Innovation Block · First Floor",
    description:
      "A collaborative space for group discussions and projects.",
    capacity: 8,
    available: 3,
    image:
      "https://images.unsplash.com/photo-1497366811353-6870744d04b2",
    facilities: ["Wi-Fi", "Display", "Whiteboard"],
  },
  {
    id: 4,
    name: "Digital Workspace",
    type: "Computer Lab",
    location: "Technology Block · Third Floor",
    description:
      "A dedicated workspace equipped for digital learning.",
    capacity: 30,
    available: 0,
    image:
      "https://images.unsplash.com/photo-1498050108023-c5249f4df085",
    facilities: ["Computers", "Wi-Fi", "Charging"],
  },
  {
    id: 5,
    name: "Open Study Lounge",
    type: "Individual Desk",
    location: "Student Centre · First Floor",
    description:
      "A comfortable space for independent study and reading.",
    capacity: 24,
    available: 12,
    image:
      "https://images.unsplash.com/photo-1497366216548-37526070297c",
    facilities: ["Wi-Fi", "Charging"],
  },
  {
    id: 6,
    name: "Research Room",
    type: "Group Room",
    location: "Academic Block · Second Floor",
    description:
      "A smaller room suited to focused team research sessions.",
    capacity: 6,
    available: 2,
    image:
      "https://images.unsplash.com/photo-1497366754035-f200968a6e72",
    facilities: ["Wi-Fi", "Whiteboard"],
  },
];
