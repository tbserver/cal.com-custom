import { NextResponse } from "next/server";

import prisma from "@calcom/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { bookingUid, products } = body;

    if (!bookingUid || !Array.isArray(products)) {
      return NextResponse.json({ error: "Missing bookingUid or products" }, { status: 400 });
    }

    // Find the booking
    const booking = await prisma.booking.findUnique({
      where: { uid: bookingUid },
      select: { id: true, description: true },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Format product selection text
    const productLines = products.map(
      (p: { title: string; variantTitle: string; quantity: number; price: string; currency: string }) => {
        const variantStr = p.variantTitle && p.variantTitle !== "Default Title" ? ` (${p.variantTitle})` : "";
        const priceNum = parseFloat(p.price) * p.quantity;
        const formatted = new Intl.NumberFormat("fr-FR", {
          style: "currency",
          currency: p.currency || "EUR",
        }).format(priceNum);
        return `• ${p.title}${variantStr} x${p.quantity} — ${formatted}`;
      }
    );

    const selectionText = `\n\n--- Pré-sélection produits ---\n${productLines.join("\n")}`;

    // Append to existing description
    const newDescription = (booking.description || "") + selectionText;

    await prisma.booking.update({
      where: { id: booking.id },
      data: { description: newDescription },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to save product selection:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
