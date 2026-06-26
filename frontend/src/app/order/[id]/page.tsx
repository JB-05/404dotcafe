import { OrderTrackClient } from "@/components/OrderTrackClient";

export default async function OrderTrackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OrderTrackClient orderId={id} />;
}
