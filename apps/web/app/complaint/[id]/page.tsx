import type { Metadata } from "next";
import { displayDealerCode } from "@tmp/shared";
import { notFound } from "next/navigation";
import { getPump, getReports } from "@/lib/data";
import ComplaintAssistant from "@/components/ComplaintAssistant";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const pump = await getPump(id);
  return pump ? { title: `File a formal complaint — ${pump.name}` } : {};
}

export default async function ComplaintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pump = await getPump(id);
  if (!pump) notFound();
  const reports = await getReports(id);

  return (
    <>
      <div className="detail-head">
        <div>
          <div className="pump-meta">
            File a formal complaint · {pump.omc}
            {displayDealerCode(pump.dealerCode) && ` · dealer ${displayDealerCode(pump.dealerCode)}`}
          </div>
          <h1>{pump.name}</h1>
          <div className="pump-meta">
            CPGRAMS has no public filing API — we prepare everything and you
            press the button. The citizen files; that&apos;s also what keeps it
            legally clean.
          </div>
        </div>
      </div>
      <ComplaintAssistant pump={pump} fallbackReports={reports} />
    </>
  );
}
