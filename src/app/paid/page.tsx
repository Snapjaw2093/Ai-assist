import { BUSINESS } from "@/config/receptionist";

export default async function Paid({ searchParams }: { searchParams: Promise<{ cancelled?: string }> }) {
  const { cancelled } = await searchParams;
  return (
    <div className="login">
      <div className="card" style={{ textAlign: "center" }}>
        <div className="brand" style={{ padding: 0 }}>{BUSINESS.name}</div>
        <p>{cancelled ? "No payment was taken. Use the link in your text to try again." : "Deposit received. Thank you! You're all set, and we'll see you at your appointment."}</p>
      </div>
    </div>
  );
}
