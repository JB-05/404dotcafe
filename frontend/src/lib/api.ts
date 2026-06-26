const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export type MenuItem = {
  id: number;
  external_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  veg: boolean;
  available: boolean;
  prep_time: number;
  customizations: { name: string; price: number }[];
};

export type MenuCategory = {
  id: number;
  name: string;
  slug: string;
  display_order: number;
  items: MenuItem[];
};

export type MenuResponse = {
  cafe_name: string;
  categories: MenuCategory[];
};

export function fetchMenu() {
  return apiFetch<MenuResponse>("/api/v1/menu");
}
