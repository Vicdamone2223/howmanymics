export const metadata = {
  title: 'Privacy Policy | How Many Mics',
  description: 'Privacy Policy for HowManyMics.com explaining how we collect, use, and protect user information.',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12 text-zinc-100">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>

      <p className="mb-4">
        This Privacy Policy describes how <strong>HowManyMics.com</strong> collects, uses, and protects your information when you visit our website.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">Information We Collect</h2>
      <p className="mb-4">
        We may collect non-personal information such as browser type, device information, pages visited, and referring URLs. We may also collect personal information you voluntarily provide, such as your name or email when you contact us.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">Cookies and Advertising</h2>
      <p className="mb-4">
        HowManyMics.com uses cookies to personalize content and analyze traffic. We partner with advertising platforms like Ezoic to display ads that may be relevant to you. These third-party partners may use cookies and similar technologies to track your browsing behavior.
      </p>
      <p className="mb-4">
        You can control or delete cookies through your browser settings. For more information about Ezoic’s data practices, visit <a href="https://g.ezoic.net/privacy/howmanymics.com" className="text-blue-400 underline">Ezoic’s Privacy Policy</a>.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">Analytics</h2>
      <p className="mb-4">
        We use analytics tools such as Google Analytics to understand how visitors use our site. These tools use cookies to collect standard internet log information and visitor behavior in an anonymous form.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">Your Consent</h2>
      <p className="mb-4">
        By using our website, you consent to our Privacy Policy.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">Updates to This Policy</h2>
      <p className="mb-4">
        We may update this Privacy Policy periodically. The updated version will be posted on this page with a new effective date.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">Contact Us</h2>
      <p>
        If you have any questions about this Privacy Policy, you can contact us at <a href="mailto:info@howmanymics.com" className="text-blue-400 underline">info@howmanymics.com</a>.
      </p>
    </main>
  );
}
