export interface ChangelogEntry {
    version: string;
    releasedOn: string;
    highlights: string[];
}

export interface LegalSection {
    title: string;
    paragraphs: string[];
}

export interface SitemapEntry {
    title: string;
    route: string;
    description: string;
    access: 'public' | 'authenticated' | 'admin';
}

export const BRAND = {
    productName: 'Vahi',
    companyName: 'AutoLoop',
    legalEntityName: 'AutoLoop Technologies',
    supportEmail: 'support@autoloop.app',
    salesEmail: 'sales@autoloop.app',
    legalEmail: 'legal@autoloop.app',
    privacyEmail: 'privacy@autoloop.app',
    website: 'https://autoloop.vercel.app',
    legalLastUpdated: 'February 13, 2026',
    legalJurisdiction: 'India',
} as const;

export const STACK_ROUTE_TITLES = {
    about: 'About',
    changelog: 'Changelog',
    terms: 'Terms of Service',
    privacy: 'Privacy Policy',
    sitemap: 'Sitemap',
} as const;

export const TAB_TITLES = {
    home: 'Home',
    stock: 'Stock',
    bill: 'Bill',
    reports: 'Reports',
    settings: 'Settings',
} as const;

export const SETTINGS_TEXT = {
    title: 'Settings',
    userFallback: 'User',
    sections: {
        appearance: 'Appearance',
        billingPreferences: 'Billing Preferences',
        account: 'Account',
        dataSync: 'Data Sync',
        appInformation: 'App Information',
    },
    appearance: {
        useSystemTheme: 'Use System Theme',
        darkMode: 'Dark Mode',
        darkModeSystemNote: 'Disabled while using system theme',
    },
    billing: {
        currencyPrefix: 'Currency:',
    },
    account: {
        subscriptionTitle: 'Subscription & Payments',
        subscriptionInactive: 'No active plan',
        subscriptionActiveSuffix: 'active',
        adminPanelTitle: 'Admin Control Panel',
        adminPanelDescription: 'Manage users, plans, and offers',
        businessProfileTitle: 'Business Profile',
        businessProfileDescription: 'Manage company details',
    },
    appInfo: {
        aboutTitle: 'About',
        aboutDescription: `What ${BRAND.productName} is and who it is for`,
        changelogTitle: 'Changelog',
        changelogDescription: 'See what changed in each release',
        termsTitle: 'Terms of Service',
        termsDescription: 'Rules and usage conditions',
        privacyTitle: 'Privacy Policy',
        privacyDescription: 'How data is handled and protected',
        sitemapTitle: 'Sitemap',
        sitemapDescription: 'App route index',
    },
    dataSync: {
        title: 'Offline Queue',
        statusLabel: 'Pending Changes',
        oldestLabel: 'Oldest Pending',
        lastSyncLabel: 'Last Sync',
        idleMessage: 'All local changes are synced.',
        queuedMessage: 'Some local changes are waiting to sync.',
        syncingMessage: 'Sync in progress...',
        syncNowButton: 'Sync Now',
    },
    updateCard: {
        title: 'Version & Updates',
        versionLabel: 'Version',
        buildLabel: 'Build',
        runtimeLabel: 'Runtime',
        channelLabel: 'Channel',
        statusLabel: 'Update Status',
        lastCheckedLabel: 'Last Checked',
        checkButton: 'Check for Updates',
        applyButton: 'Restart to Apply Update',
    },
    updateStatus: {
        idle: 'Idle',
        checking: 'Checking',
        downloading: 'Downloading',
        upToDate: 'Up to date',
        downloaded: 'Ready to apply',
        disabled: 'Unavailable',
        error: 'Error',
    },
    updateMessages: {
        initial: 'Auto update check pending.',
        devOnly: 'Auto updates are available in production builds only.',
        webManaged: 'Web updates are handled via deployment builds.',
        disabled: 'Auto updates are disabled for this build.',
        checking: 'Checking for updates...',
        upToDate: 'You are using the latest version.',
        downloading: 'Update available. Downloading now...',
        downloaded: 'Update downloaded. Restart app to apply it.',
        failed: 'Failed to check for updates.',
        applyFailed: 'Failed to apply update.',
    },
    errors: {
        generic: 'Error',
        currencySaveFailed: 'Failed to save currency preference.',
        updateError: 'Update Error',
    },
    actions: {
        signOut: 'Sign Out',
    },
} as const;

export const COMMON_TEXT = {
    alerts: {
        error: 'Error',
        success: 'Success',
        validation: 'Validation',
        saved: 'Saved',
        loginRequired: 'Login Required',
        noData: 'No Data',
    },
    actions: {
        cancel: 'Cancel',
        delete: 'Delete',
        back: 'Back',
        share: 'Share',
        refresh: 'Refresh',
        checkout: 'Checkout',
        save: 'Save',
        update: 'Update',
        create: 'Create',
        open: 'Open',
        next: 'Next',
        skip: 'Skip',
        getStarted: 'Get Started',
    },
    labels: {
        yes: 'Yes',
        no: 'No',
        none: 'None',
    },
    messages: {
        offlineMode: 'Offline mode: changes may sync when connection returns.',
    },
} as const;

export const AUTH_TEXT = {
    login: {
        title: BRAND.productName,
        subtitle: 'Sign in to continue',
        googleSignInNotConfiguredTitle: 'Google Sign-In Not Configured',
        googleSignInNotConfiguredBody:
            'Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (plus platform client IDs where needed) in your .env file and ensure Android SHA fingerprints are added in Google Cloud.',
        phoneNotSupportedTitle: 'Not Supported',
        phoneNotSupportedBody: 'Phone sign-in is not available until reCAPTCHA is ready.',
        enterPhoneNumber: 'Enter phone number',
        otpSent: 'OTP Sent',
        unableToSendOtp: 'Unable to send OTP.',
        enterCode: 'Enter code',
        unableToVerifyCode: 'Unable to verify code.',
        recaptchaInitFailed: 'Failed to initialize reCAPTCHA.',
        loginErrorTitle: 'Login Error',
        phoneNumberLabel: 'Phone Number',
        verificationCodeLabel: 'Verification Code',
        sendCodeButton: 'Send Code',
        verifyCodeButton: 'Verify Code',
        signInWithGoogleButton: 'Sign in with Google',
        signInWithPhoneButton: 'Sign in with Phone',
    },
} as const;

export const ONBOARDING_TEXT = {
    slides: [
        {
            id: '1',
            title: `Welcome to ${BRAND.productName}`,
            description: 'Generate professional invoices and manage your billing effortlessly.',
            icon: 'file-document-outline',
        },
        {
            id: '2',
            title: 'Manage Inventory',
            description: 'Keep track of your stock levels in real-time with barcode scanning.',
            icon: 'package-variant-closed',
        },
        {
            id: '3',
            title: 'Grow Your Business',
            description: 'Get actionable insights and reports to scale your operations.',
            icon: 'chart-line',
        },
    ],
} as const;

export const BUSINESS_SETUP_TEXT = {
    title: 'Setup Business',
    subtitle: `Enter your business details to get started with ${BRAND.productName}.`,
    requiredBusinessName: 'Business Name is required',
    saveFailed: 'Failed to save business details.',
    fields: {
        businessName: 'Business Name',
        businessAddress: 'Business Address',
        gstNumber: 'GST Number (Optional)',
        defaultCurrency: 'Default Currency',
    },
    actions: {
        startBilling: 'Start Billing',
    },
} as const;

export const SUBSCRIPTION_TEXT = {
    title: 'Subscription Plans',
    subtitle:
        'Pick a monthly plan. Use test buttons for payment success/failure until real gateway integration is added.',
    currentSubscriptionTitle: 'Current Subscription',
    statusLabel: 'Status',
    planLabel: 'Plan',
    validUntilLabel: 'Valid Until',
    selectedLabel: 'Selected',
    loadingPlans: 'Loading latest plans from admin panel...',
    noPlan: COMMON_TEXT.labels.none,
    paymentSuccessTitle: 'Payment Success',
    paymentFailedTitle: 'Payment Failed',
    testSuccessResult: 'Subscription activated for one month.',
    testFailureResult: 'This is a test failure. Subscription was not updated.',
    testFailureCardMessage: 'Test payment marked as failed. No subscription changes applied.',
    activateFailed: 'Failed to activate subscription.',
    checkoutStartFailed: 'Failed to start checkout.',
    checkoutUnavailable: 'Checkout Unavailable',
    checkoutUnavailableDefault: 'Payment checkout is not configured yet.',
    checkoutDisabledNote: 'Live payment is currently disabled. Use test success/failure buttons for now.',
    openFailedTitle: 'Open Failed',
    openFailedBody: 'Could not open checkout URL.',
    checkoutStartedTitle: 'Checkout Started',
    checkoutStartedBody:
        'Complete payment in provider page. Subscription will be activated by secure webhook after verification.',
    loginToActivate: 'Please login to activate subscription.',
    loginToContinue: 'Please login to continue.',
    startLiveButton: 'Start Live Payment (Scaffold)',
    startLiveDisabledButton: 'Live Payment Disabled',
    testSuccessButton: 'Test Payment Success',
    testFailButton: 'Test Payment Fail',
} as const;

export const ADMIN_TEXT = {
    accessRequiredTitle: 'Admin Access Required',
    accessRequiredBody: 'This panel is restricted to developer/admin principals configured on server.',
    title: 'Admin Control Panel',
    subtitle: 'Manage users, subscription plans, offers, and sales automation settings.',
    refresh: COMMON_TEXT.actions.refresh,
    salesFunnelTitle: 'Sales Funnel (Last 30 Days)',
    salesFunnel: {
        views: 'Views',
        planSelects: 'Plan Selects',
        checkoutStart: 'Checkout Start',
        redirected: 'Redirected',
        success: 'Success',
        failed: 'Failed',
        viewToPlan: 'View to Plan',
        planToCheckout: 'Plan to Checkout',
        checkoutToSuccess: 'Checkout to Success',
        overall: 'Overall Conversion',
    },
    tabs: {
        users: 'Users',
        plans: 'Plans',
        offers: 'Offers',
    },
    users: {
        searchLabel: 'Search users (name/email/business)',
        countSuffix: 'user(s) found',
        planLabel: 'Plan',
        validUntilLabel: 'Valid Until',
        makeAdmin: 'Make Admin',
        makeOwner: 'Make Owner',
        activatePlan: 'Activate Plan',
        expire: 'Expire',
    },
    plans: {
        planName: 'Plan Name',
        description: 'Description',
        monthlyPrice: 'Monthly Price',
        currency: 'Currency',
        features: 'Features (comma separated)',
        active: 'Active',
        currentPrice: 'Current Price',
        savePlan: 'Save Plan',
    },
    offers: {
        createTitle: 'Create Offer Banner',
        title: 'Title',
        message: 'Message',
        bannerImage: 'Banner Image URL (optional)',
        bannerColor: 'Banner Color',
        priority: 'Priority',
        ctaText: 'CTA Text',
        ctaRoute: 'CTA Route',
        publishNow: 'Publish Immediately',
        createOffer: 'Create Offer',
        audience: 'Audience',
    },
    alerts: {
        loadAdminFailed: 'Failed to load admin data.',
        roleUpdated: (role: string) => `Role updated to ${role}.`,
        roleUpdateFailed: 'Failed to update role.',
        noPlanTitle: 'No Plan',
        noPlanBody: 'No active plan is available.',
        subscriptionUpdatedTitle: 'Subscription Updated',
        subscriptionUpdatedBody: (name: string) => `${name} has active subscription.`,
        activateSubscriptionFailed: 'Failed to activate subscription.',
        subscriptionStatusUpdated: (status: string) => `Subscription marked as ${status}.`,
        subscriptionStatusFailed: 'Failed to update subscription status.',
        planNameRequired: 'Plan name is required.',
        monthlyPriceInvalid: 'Monthly price must be a non-negative number.',
        planUpdated: (name: string) => `${name} plan updated.`,
        savePlanFailed: 'Failed to save plan.',
        offerTitleMessageRequired: 'Offer title and message are required.',
        offerPriorityInvalid: 'Priority must be a number.',
        offerCreatedTitle: 'Offer Created',
        offerCreatedBody: 'Marketing offer banner is now available.',
        createOfferFailed: 'Failed to create offer.',
        offerToggleFailed: 'Failed to update offer state.',
    },
} as const;

export const BILLING_TEXT = {
    searchPlaceholder: 'Search item to add...',
    customerName: 'Customer Name (Optional)',
    customerPhone: 'Phone (Optional)',
    currentBillTitle: 'Current Bill',
    totalLabel: 'Total',
    checkoutButton: COMMON_TEXT.actions.checkout,
    outOfStockTitle: 'Out of Stock',
    outOfStockBody: (name: string, stock: number) => `Only ${stock} unit(s) available for ${name}.`,
    itemMissingTitle: 'Item Missing',
    itemMissingBody: (name: string) => `"${name}" no longer exists. Please refresh inventory.`,
    insufficientStockTitle: 'Insufficient Stock',
    insufficientStockBody: (name: string, stock: number) => `"${name}" has only ${stock} unit(s) available.`,
    billCreatedTitle: 'Bill Created',
    billCreatedPrompt: 'Share or Print Bill?',
    sharePdfButton: 'Share PDF',
    checkoutFailed: 'Failed to complete checkout.',
    inStockSuffix: 'in stock',
} as const;

export const REPORTS_TEXT = {
    title: 'Reports',
    subtitle: 'Sales snapshot and recent orders',
    activeRangePrefix: 'Active Range:',
    ranges: {
        today: 'Today',
        '7d': 'Last 7 Days',
        '30d': 'Last 30 Days',
        all: 'All Time',
    },
    rangeButtons: {
        today: 'Today',
        '7d': '7 Days',
        '30d': '30 Days',
        all: 'All',
    },
    metrics: {
        revenue: 'Revenue',
        orders: 'Orders',
        topProducts: 'Top Products',
    },
    noProductSales: 'No product sales in selected range.',
    noBillsInRange: 'No bills in this range.',
    noDataBody: 'No orders found in the selected range.',
    shareSummaryFailed: 'Failed to share summary report.',
    shareBillFailed: 'Failed to share bill.',
    lineItemSuffix: 'line item(s)',
} as const;

export const STOCK_TEXT = {
    itemDetail: {
        addTitle: 'Add New Item',
        editTitle: 'Edit Item',
        fields: {
            itemName: 'Item Name',
            price: 'Price',
            stock: 'Stock',
            barcode: 'Barcode (Optional)',
        },
        actions: {
            saveItem: 'Save Item',
            updateItem: 'Update Item',
            deleteItem: 'Delete Item',
        },
        alerts: {
            fillRequired: 'Please fill required fields',
            invalidPrice: 'Please enter a valid price.',
            invalidStock: 'Stock must be a whole number greater than or equal to 0.',
            itemAdded: 'Item added',
            invalidItemId: 'Invalid item id.',
            itemUpdated: 'Item updated',
            saveFailed: 'Failed to save item.',
            deleteTitle: 'Delete Item',
            deleteBody: 'This will permanently remove the item from inventory.',
            deletedTitle: 'Deleted',
            deletedBody: 'Item removed successfully.',
            deleteFailed: 'Failed to delete item.',
        },
    },
} as const;

export const ABOUT_TEXT = {
    title: `About ${BRAND.productName}`,
    whatWeDoTitle: `What ${BRAND.productName} Does`,
    contactTitle: 'Contact',
    legalNoticeTitle: 'Legal Notice',
    legalNotice:
        `This policy set is written for ${BRAND.companyName}. ` +
        'Use it as a strong production template and complete local counsel review before final publication.',
    lastUpdatedPrefix: 'Last updated:',
    supportLabel: 'Support',
    salesLabel: 'Sales',
    summary: [
        `${BRAND.productName} helps small businesses create bills, manage stock, and track performance in one place.`,
        `${BRAND.companyName} builds ${BRAND.productName} for fast checkout, reliable records, and practical growth operations.`,
    ],
} as const;

export const CHANGELOG_TEXT = {
    title: 'Changelog',
    subtitle: 'Release notes by version.',
    releasedPrefix: 'Released:',
} as const;

export const LEGAL_TEXT = {
    termsTitle: 'Terms of Service',
    privacyTitle: 'Privacy Policy',
    lastUpdatedPrefix: 'Last updated:',
} as const;

export const SITEMAP_TEXT = {
    title: 'Sitemap',
    subtitle: 'Main routes currently available in the app.',
    routePrefix: 'Route:',
    openButton: 'Open',
    accessLabels: {
        admin: 'Admin',
        public: 'Public',
        authenticated: 'Signed in',
    },
} as const;

export const APP_CHANGELOG: ChangelogEntry[] = [
    {
        version: '3.0.1',
        releasedOn: '2026-02-18',
        highlights: [
            'Full stability + layout sweep across client screens: normalized responsive content shells and compact spacing in shared headers / screen wrappers.',
            'Fixed centered action button alignment in bottom navigation and improved tab shell positioning.',
            'Improved scroll / layout consistency for Admin, Info pages, Business Suite pages, Billing, and route-level shells.',
            'Treated transient backend failures (429, 5xx) as network-like for silent fallback behavior.',
            'Reduced repeated organization context sync calls with throttled refresh in main layout.',
            'Kept route structure stable with accounting stack registration updates.',
            'Improved checkout drawer responsiveness - QR size adapts by viewport, actions wrap on narrow screens.',
        ]
    },
    {
        version: '2.0.0',
        releasedOn: '2026-02-16',
        highlights: [
            'Upgraded staff RBAC with sale/purchase/report/party/dashboard controls and owner-level feature toggles.',
            'Added Business Card Studio with 12 templates, business auto-fill, custom card upload, and in-app sharing.',
            'Aligned plan architecture to Free/Pro/Enterprise with Free capped at 50 bills per month and plan-based upload limits.',
            'Added server-enforced feature toggles for billing modes, reports, party ledger, and inventory write flows.',
            'Improved tab visibility and screen access handling so staff only see modules enabled by owner permissions.',
            'Enhanced media pipeline with plan-aware signed upload limits and organization-scoped context sync.',
        ],
    },
    {
        version: '1.0.1',
        releasedOn: '2026-02-16',
        highlights: [
            'Added company switch and multi-store organization support in Business Suite.',
            'Added staff permission controls, signature management, and institution reminder tooling.',
            'Added subscription management with test success/failure flows and live checkout scaffold.',
            'Added admin control panel for users, plans, offers, and funnel monitoring.',
            'Added marketing banners, analytics events, and automation jobs for lifecycle management.',
            'Improved API organization scoping and reduced redundant state updates.',
        ],
    },
    {
        version: '1.0.0',
        releasedOn: '2026-01-15',
        highlights: [
            'Initial production release with billing, stock tracking, reports, and onboarding.',
        ],
    },
];

export const TERMS_SECTIONS: LegalSection[] = [
    {
        title: '1. Scope and Acceptance',
        paragraphs: [
            `These Terms govern your use of ${BRAND.productName}, operated by ${BRAND.legalEntityName} (${BRAND.companyName}, we, us, or our).`,
            'By creating an account or using the services, you agree to these Terms and all applicable laws.',
        ],
    },
    {
        title: '2. Eligibility and Account Security',
        paragraphs: [
            'You must provide accurate registration and business information and keep it updated.',
            'You are responsible for credential security and all actions taken under your account.',
        ],
    },
    {
        title: '3. Subscription, Billing, and Payment',
        paragraphs: [
            'Paid features are provided according to your selected subscription plan and plan limits.',
            'Subscription renewals, failed charges, retries, and cancellations are handled under plan terms and payment provider rules.',
            'Unless otherwise required by law, fees are non-refundable after service activation.',
        ],
    },
    {
        title: '4. Acceptable Use',
        paragraphs: [
            `You must not use ${BRAND.productName} for unlawful, fraudulent, abusive, or infringing activities.`,
            'You must not interfere with service integrity, reverse engineer restricted components, or attempt unauthorized access.',
        ],
    },
    {
        title: '5. Data Ownership and License',
        paragraphs: [
            'You retain ownership of your business records and content submitted to the platform.',
            `You grant ${BRAND.companyName} a limited license to process that data strictly to operate, secure, maintain, and improve the services.`,
        ],
    },
    {
        title: '6. Service Availability and Changes',
        paragraphs: [
            'We may update features, limits, pricing, and infrastructure as the service evolves.',
            'Availability targets are commercially reasonable, but uninterrupted service is not guaranteed.',
        ],
    },
    {
        title: '7. Third-Party Providers',
        paragraphs: [
            'Some functions depend on third-party services such as cloud hosting, analytics, and payment providers.',
            'Your use of those integrations may also be subject to their own terms and privacy policies.',
        ],
    },
    {
        title: '8. Intellectual Property',
        paragraphs: [
            `${BRAND.productName} software, design, trademarks, and related assets are protected intellectual property of ${BRAND.legalEntityName} or its licensors.`,
        ],
    },
    {
        title: '9. Disclaimer of Warranties',
        paragraphs: [
            'Services are provided on an as-is and as-available basis to the maximum extent allowed by law.',
            'We disclaim implied warranties including merchantability, fitness for a particular purpose, and non-infringement.',
        ],
    },
    {
        title: '10. Limitation of Liability',
        paragraphs: [
            'To the maximum extent permitted by law, we are not liable for indirect, incidental, special, consequential, or punitive losses.',
            'Total liability related to the service is limited to fees paid by you for the previous 12 months.',
        ],
    },
    {
        title: '11. Termination and Governing Law',
        paragraphs: [
            'We may suspend or terminate access for violations, fraud risk, abuse, legal requests, or security concerns.',
            `These Terms are governed by the laws of ${BRAND.legalJurisdiction}.`,
            `For legal notices, contact ${BRAND.legalEmail}.`,
        ],
    },
];

export const PRIVACY_SECTIONS: LegalSection[] = [
    {
        title: '1. Data Controller',
        paragraphs: [
            `${BRAND.legalEntityName} is the controller of personal data processed through ${BRAND.productName}.`,
        ],
    },
    {
        title: '2. Data We Collect',
        paragraphs: [
            'We collect account identity data, business profile details, billing and stock records, subscription metadata, and limited product usage events.',
            'We also collect technical diagnostics needed for reliability, fraud prevention, and support.',
        ],
    },
    {
        title: '3. How We Use Data',
        paragraphs: [
            'We process data to deliver core features, authenticate users, process subscriptions, secure the platform, and improve product quality.',
            'Where needed, we process data to comply with legal obligations and enforce contractual terms.',
        ],
    },
    {
        title: '4. Legal Bases',
        paragraphs: [
            'Processing is based on contract performance, legitimate business interests, legal obligations, and consent where required.',
        ],
    },
    {
        title: '5. Data Sharing',
        paragraphs: [
            'We do not sell personal data.',
            'Data may be shared with vetted processors and infrastructure partners only to operate services, payments, analytics, and support.',
        ],
    },
    {
        title: '6. International Transfers',
        paragraphs: [
            'Where data is processed outside your country, we apply appropriate contractual and technical safeguards.',
        ],
    },
    {
        title: '7. Retention',
        paragraphs: [
            'We retain data based on business need, legal compliance, tax and audit requirements, dispute handling, and security obligations.',
        ],
    },
    {
        title: '8. Security',
        paragraphs: [
            'We use reasonable administrative, technical, and organizational controls to protect data.',
            'No system is absolutely secure, so users should protect credentials and device access.',
        ],
    },
    {
        title: '9. Your Rights',
        paragraphs: [
            'Subject to local law, you may request access, correction, deletion, restriction, or portability of your personal data.',
            `For privacy requests, contact ${BRAND.privacyEmail}.`,
        ],
    },
    {
        title: '10. Children',
        paragraphs: [
            `${BRAND.productName} is intended for business use and not directed to children.`,
        ],
    },
    {
        title: '11. Contact',
        paragraphs: [
            `${BRAND.companyName} Privacy Team: ${BRAND.privacyEmail}`,
            `General support: ${BRAND.supportEmail}`,
            `Website: ${BRAND.website}`,
        ],
    },
];

export const APP_SITEMAP: SitemapEntry[] = [
    {
        title: 'Home',
        route: '/home',
        description: 'Dashboard overview and quick actions.',
        access: 'authenticated',
    },
    {
        title: 'Stock',
        route: '/stock',
        description: 'Inventory list and item management.',
        access: 'authenticated',
    },
    {
        title: 'Billing',
        route: '/billing',
        description: 'Invoice creation and billing workflows.',
        access: 'authenticated',
    },
    {
        title: 'Reports',
        route: '/reports',
        description: 'Sales and performance analytics.',
        access: 'authenticated',
    },
    {
        title: 'Settings',
        route: '/settings',
        description: 'Profile, preferences, and app controls.',
        access: 'authenticated',
    },
    {
        title: 'Subscription',
        route: '/subscription',
        description: 'Plan selection and payment state.',
        access: 'authenticated',
    },
    {
        title: 'Admin Panel',
        route: '/admin',
        description: 'User, plan, and offer administration.',
        access: 'admin',
    },
    {
        title: 'Business Setup',
        route: '/business-setup',
        description: 'Business profile and GST details.',
        access: 'authenticated',
    },
    {
        title: 'Login',
        route: '/(auth)/login',
        description: 'Authentication entry point.',
        access: 'public',
    },
    {
        title: 'Onboarding',
        route: '/(auth)/onboarding',
        description: 'First-time app introduction.',
        access: 'public',
    },
    {
        title: 'About',
        route: '/about',
        description: `About ${BRAND.productName} and ${BRAND.companyName}.`,
        access: 'public',
    },
    {
        title: 'Changelog',
        route: '/changelog',
        description: 'Release notes and updates.',
        access: 'public',
    },
    {
        title: 'Terms of Service',
        route: '/terms',
        description: 'Service terms and legal conditions.',
        access: 'public',
    },
    {
        title: 'Privacy Policy',
        route: '/privacy',
        description: 'Privacy and data handling policy.',
        access: 'public',
    },
    {
        title: 'Sitemap',
        route: '/sitemap',
        description: 'Route directory for the app.',
        access: 'public',
    },
];
