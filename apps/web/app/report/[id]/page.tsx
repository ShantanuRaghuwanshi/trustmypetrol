import type { Metadata } from "next";
import { displayDealerCode } from "@tmp/shared";
import { notFound } from "next/navigation";
import { getPump } from "@/lib/data";
import ReportForm from "@/components/ReportForm";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const pump = await getPump(id);
  return pump ? { title: `Report an issue — ${pump.name}` } : {};
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pump = await getPump(id);
  if (!pump) notFound();

  return (
    <>
      <div className="detail-head">
        <div>
          <div className="pump-meta">
            Report an issue · {pump.omc}
            {displayDealerCode(pump.dealerCode) && ` · dealer ${displayDealerCode(pump.dealerCode)}`}
          </div>
          <h1>{pump.name}</h1>
          <div className="pump-meta">
            {pump.address}, {pump.district}
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 560 }}>
        <ReportForm pump={pump} />
      </div>
    </>
  );
}
