import Link from 'next/link';

export const metadata = { title: 'Refund & Cancellation Policy | Pixenar' };

export default function RefundPolicyPage() {
  return <main style={{maxWidth:850,margin:'0 auto',padding:'64px 24px',color:'#e2e8f0',lineHeight:1.75}}>
    <Link href="/pricing" style={{color:'#67e8f9'}}>← Back to pricing</Link>
    <h1 style={{fontSize:36,fontWeight:800,marginTop:30}}>Refund & Subscription Cancellation Policy</h1>
    <p>PixenarAI · Pixenar Studio · PixenarMV — Operated by Pensrikris36 LLC</p>
    <p><strong>Policy status:</strong> Draft pending legal review. This page does not change the terms of previous purchases.</p>
    <h2>Subscription cancellation</h2>
    <p>You may cancel future subscription renewals through account controls or support. Cancellation does not automatically refund the current billing period. Access and remaining credits follow the terms disclosed at purchase and applicable law.</p>
    <h2>AI generation credits</h2>
    <p>AI generation incurs computational and provider costs. Credits consumed on successfully generated and delivered services are generally not refundable solely because of a change of mind or subjective dissatisfaction. Consuming credits does not itself establish successful delivery.</p>
    <h2>Refund eligibility</h2>
    <p>We review requests individually. Billing errors, duplicate charges, verified failed or inaccessible outputs, materially unavailable or misrepresented features, and legally required remedies may qualify for restored credits, a retry, a partial refund, or a full refund. Partially used purchases may be considered based on the services delivered and applicable terms.</p>
    <h2>Failed generations</h2>
    <p>Missing, inaccessible, corrupted, or materially nonconforming outputs are not automatically treated as delivered. We investigate verified technical failures and provide an appropriate remedy.</p>
    <h2>Requesting a refund</h2>
    <p>Contact the support channel listed in your account or payment receipt, including your account email, transaction details and a description of the issue. We aim to acknowledge requests within two business days and provide an initial decision within five business days, without limiting legal deadlines.</p>
    <h2>Approved refunds and disputes</h2>
    <p>Approved refunds are returned to the original payment method where supported. Unused credits attributable to refunded purchases may be revoked. Nothing in this policy limits lawful payment disputes or non-waivable consumer rights.</p>
    <p>Any revised terms apply prospectively only when properly disclosed and accepted. This draft should be reviewed by legal counsel before being adopted as binding checkout terms.</p>
  </main>;
}
