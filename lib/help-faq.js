"use strict";

// This content is server-only. Do not move permission-scoped entries into public assets.
const FAQ_SECTIONS = Object.freeze([
  {
    "id": "getting-started",
    "audience": "public",
    "icon": "👋",
    "title": "Getting Started",
    "items": [
      {
        "question": "What is the Fire Of God Ministries Community Portal?",
        "answer": "The Community Portal is our shared online space for the Fire Of God Ministries family. It brings together events, member information, ministries, prayer, growth activities, games, reminders, and other helpful community features in one place."
      },
      {
        "question": "Do I need an account?",
        "answer": "Some parts can be viewed without signing in. An account is needed for things that belong to you personally, such as your profile, growth journey, attendance, schedule, scores, messages, and other saved activities."
      },
      {
        "question": "Can I add the Community Portal to my phone?",
        "answer": "Yes. You can add the Community Portal to your phone’s Home Screen so it is easier to open and feels more like an app."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "account-sign-in",
    "audience": "public",
    "icon": "👤",
    "title": "Account, Sign In & Privacy",
    "items": [
      {
        "question": "How do I sign in?",
        "answer": "Open the Sign In page and use your Community Portal account or Google Sign-In when that option is available for your account."
      },
      {
        "question": "What if I forget my password?",
        "answer": "Tap “Forgot password?” on the Sign In page, enter your email, and follow the recovery instructions if password recovery is available for your account."
      },
      {
        "question": "Why doesn’t the Portal tell me if an email is registered?",
        "answer": "This protects member privacy. Password recovery uses the same public response whether or not an email is connected to an account."
      },
      {
        "question": "Can I use Google Sign-In?",
        "answer": "Yes, when it is available for your account. Google Sign-In uses your verified Google identity while the Community Portal still applies its own membership and permission rules."
      },
      {
        "question": "What is Account Claim?",
        "answer": "Account Claim helps an existing FOG member securely connect a Portal sign-in to the correct existing member record. Temporary Account Claim links or QR codes are one-time onboarding tools and are not attendance QR codes."
      },
      {
        "question": "Why might I be asked to verify my email?",
        "answer": "Email verification helps confirm that an email address belongs to you before it is trusted for account recovery or other account-sensitive actions."
      },
      {
        "question": "Why am I asked to accept the Privacy Policy and Terms of Service?",
        "answer": "The Portal requires the current Privacy Policy and Terms of Service to be acknowledged before normal account use. Your acceptance is recorded so there is a reliable account history of the acknowledgement."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "home-dashboard",
    "audience": "member",
    "icon": "🏠",
    "title": "Home Dashboard",
    "items": [
      {
        "question": "What is the Home Dashboard?",
        "answer": "The Home Dashboard is your starting place after you sign in. It brings together the things that may matter to you today, such as your growth journey, upcoming events, schedule, prayer, community activities, and helpful shortcuts."
      },
      {
        "question": "Why do different members see different things?",
        "answer": "Some cards and choices appear only when they are useful for your account, ministry, role, or permissions. This helps keep the Home page simple and relevant."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "growth-planner",
    "audience": "member",
    "icon": "🌱",
    "title": "Growth Journey & Planner",
    "items": [
      {
        "question": "What is the Growth Journey?",
        "answer": "The Growth Journey helps you see meaningful next steps in faith, belonging, formation, service, and mission. It is a guide for discipleship, not a score of your spiritual worth."
      },
      {
        "question": "How does my current stage work?",
        "answer": "Your current stage is based on your Journey progress and the experiences connected to each stage. The Portal highlights the next unfinished stage so you can focus on the next meaningful step."
      },
      {
        "question": "What is the Planner for?",
        "answer": "The Planner helps bring together upcoming activities, responsibilities, formation opportunities, and personal next steps that are relevant to your journey."
      },
      {
        "question": "Can everyone see my personal Growth Journey information?",
        "answer": "No. Personal Journey information is shown only where it is appropriate. Some information is for you, while authorized leaders may see only the parts needed for pastoral or discipleship support."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "my-journey-seven-milestones",
    "audience": "member",
    "icon": "🛤️",
    "title": "The Seven Growth Journey Stages",
    "items": [
      {
        "question": "What are the seven stages?",
        "answer": "The seven Growth Journey stages are Encounter → Belong → Commit → Discern → Form → Serve → Be Sent."
      },
      {
        "question": "Why does the Portal use stages?",
        "answer": "The stages help make discipleship easier to understand by showing possible next steps—from encountering Christ and finding belonging, through commitment, discernment, formation, service, and being sent in mission."
      },
      {
        "question": "Do stages measure how holy or valuable I am?",
        "answer": "No. Journey stages never measure holiness, personal worth, spiritual superiority, or God’s favor. They are simply a pastoral guide for growth and participation."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "daily-gospel-daily-manna",
    "audience": "member",
    "icon": "📖",
    "title": "Daily Gospel & Daily Manna",
    "items": [
      {
        "question": "What are Daily Gospel and Daily Manna?",
        "answer": "These areas help you return to Scripture and reflection during ordinary days, not only during gatherings. They are there to support a regular habit of listening to God’s Word."
      },
      {
        "question": "How do I use them?",
        "answer": "Open the daily reading or reflection, read at your own pace, and return whenever you want to spend time with Scripture."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "prayer-center-prayer-covenant-prayer-pal",
    "audience": "member",
    "icon": "🙏",
    "title": "Prayer Wall, Prayer Covenant & Prayer Partner",
    "items": [
      {
        "question": "What is the Prayer Wall?",
        "answer": "The Prayer Wall is a shared place where members can bring prayer intentions before the community and where others can respond by praying with them."
      },
      {
        "question": "What should I remember before posting on the Prayer Wall?",
        "answer": "Respect the privacy and dignity of everyone involved. Avoid naming or identifying another person unless they have given permission to be named or the request has been approved for public sharing by appropriate ministry leadership. Focus on the prayer intention rather than private details that could cause embarrassment, speculation, or gossip."
      },
      {
        "question": "What does Anonymous mean on a prayer request?",
        "answer": "Anonymous hides your identity as the person posting. It does not make names or private details written inside the prayer request anonymous, so sensitive identifying details should still be avoided."
      },
      {
        "question": "What is the Prayer Covenant?",
        "answer": "The Prayer Covenant helps members take part in the community’s shared rhythm of prayer and remain faithful to prayer intentions or commitments."
      },
      {
        "question": "What is Prayer Partner?",
        "answer": "Prayer Partner helps members intentionally remember and pray for another member when an assignment is available."
      },
      {
        "question": "What if a situation is too sensitive for the Prayer Wall?",
        "answer": "For sensitive pastoral, family, health, relationship, or personal situations, speak directly with a Shepherd, leader, priest, or appropriate ministry member instead of sharing private details publicly."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "spiritual-journal",
    "audience": "member",
    "icon": "✍️",
    "title": "Private Journal",
    "items": [
      {
        "question": "What is the Private Journal?",
        "answer": "The Private Journal is your personal space for gratitude, reflections, prayer notes, spiritual insights, and thoughts about your journey with God."
      },
      {
        "question": "Is my Private Journal public?",
        "answer": "No. Journal entries are intended as a personal member space. As with any online account, avoid storing information that you would never want kept digitally."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "life-points-growth-xp",
    "audience": "member",
    "icon": "🌿",
    "title": "Weekly Challenges, Games, Journey Board & Life Points",
    "items": [
      {
        "question": "What are Weekly Challenges?",
        "answer": "Weekly Challenges are simple faith and growth activities that encourage members to take small practical steps in prayer, Scripture, community life, formation, or service."
      },
      {
        "question": "How do I complete a Weekly Challenge?",
        "answer": "When you have genuinely completed a challenge, tap “Mark as Completed” and confirm it. A completed challenge is recorded once so the same completion cannot repeatedly award Life Points."
      },
      {
        "question": "What are Life Points?",
        "answer": "Life Points are encouragement tools that make participation in selected growth activities more engaging. They may be earned through activities such as Weekly Challenges, games, events, or other supported experiences."
      },
      {
        "question": "What is the Journey Board?",
        "answer": "The Journey Board celebrates our growth together. It can show participation and Life Points in a friendly community view, but it is not meant to create spiritual winners or losers."
      },
      {
        "question": "Do Life Points or rankings show who is more spiritual?",
        "answer": "No. Life Points, scores, rankings, Journey stages, and participation records are never a measure of holiness, faith, personal worth, or God’s favor."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "silas-ai-assistant",
    "audience": "member",
    "icon": "💬",
    "title": "Silas AI Assistant",
    "items": [
      {
        "question": "Who is Silas?",
        "answer": "Silas is the Community Portal’s AI helper. Silas is designed to make it easier to find help, understand Portal features, and support ministry-related questions inside the app."
      },
      {
        "question": "Is Silas a replacement for a leader, shepherd, priest, or real conversation?",
        "answer": "No. Silas is a helpful tool, but it does not replace prayer, pastoral care, spiritual guidance, community relationships, or conversations with the right people."
      },
      {
        "question": "Should I share very private information with Silas?",
        "answer": "Use good judgment with personal information. For sensitive pastoral, family, health, or private matters, it is better to speak directly with the appropriate person."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "events-registration",
    "audience": "public",
    "icon": "📅",
    "title": "Events, Registration & Sharing",
    "items": [
      {
        "question": "Where can I see upcoming events?",
        "answer": "Open Events to see upcoming gatherings and available details such as date, time, venue, poster, registration information, and other event resources."
      },
      {
        "question": "How do I pre-register or register for an event?",
        "answer": "Open the event and use the Pre-register or registration action when it is available. Follow the form shown for that specific event."
      },
      {
        "question": "Can I invite or share an event with someone?",
        "answer": "Yes. When Share Invite is available, you can use your device’s sharing options or copy the event link to send it to family, friends, or community members."
      },
      {
        "question": "Why does a shared event show its own picture and title?",
        "answer": "The Portal can prepare an event-specific social preview so people receiving the link can quickly recognize the event."
      },
      {
        "question": "Can I add an event to my calendar?",
        "answer": "When the calendar action is available for an event, use it to add the event details to your device or calendar app."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "qr-check-in-my-schedule",
    "audience": "member",
    "icon": "▦",
    "title": "QR Check-In & My Schedule",
    "items": [
      {
        "question": "What is my member QR code for?",
        "answer": "Your member QR code helps make attendance and check-in easier during supported community events and activities."
      },
      {
        "question": "Is my member QR code a password?",
        "answer": "No. Your QR code helps identify your member record during check-in. Your account password should still be kept private."
      },
      {
        "question": "What is My Schedule?",
        "answer": "My Schedule shows event responsibilities or activities assigned to you when that information is available for your account."
      },
      {
        "question": "Can I see my attendance history?",
        "answer": "Where this feature is available, you can view your recorded attendance in your member area."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "ministries-serving",
    "audience": "member",
    "icon": "🤝",
    "title": "Ministries & Serving",
    "items": [
      {
        "question": "What can I find in Ministries & Serving?",
        "answer": "You can discover ministries, see where you may be involved, express interest in serving, and view ministry information available to your account."
      },
      {
        "question": "Does having a Portal account automatically mean I joined a ministry?",
        "answer": "No. Your Portal account and ministry membership are separate. Ministry membership still follows the community’s normal guidance and leadership."
      },
      {
        "question": "Can I see my ministry role or availability?",
        "answer": "Yes, when that information is part of your account and has been made available to you."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "campfires-small-groups",
    "audience": "member",
    "icon": "🔥",
    "title": "Campfires & Fire Circles",
    "items": [
      {
        "question": "What is a Campfire?",
        "answer": "A Campfire is a small, flexible prayer and sharing group. Campfires give members a more comfortable place to pray, listen, share, and build relationships. Membership may change depending on Alpha sessions, formation activities, or current community needs."
      },
      {
        "question": "What is a Fire Circle?",
        "answer": "A Fire Circle is a stable, long-term discipleship group. Members are intentionally placed together so they can keep praying, supporting one another, building deeper relationships, and journeying together over time."
      },
      {
        "question": "Why are Campfires and Fire Circles different?",
        "answer": "Campfires provide flexible opportunities to connect and share in smaller groups. Fire Circles provide a more stable spiritual home where relationships and discipleship can deepen over the long term."
      },
      {
        "question": "How can I tell which kind of group I am viewing?",
        "answer": "Every group card shows a badge: 🔥 Campfire for a dynamic prayer/sharing group or ⭕ Fire Circle for a long-term discipleship group."
      },
      {
        "question": "Can the privacy of a Campfire or Fire Circle be different?",
        "answer": "Yes. Group type and privacy are separate. Leadership may configure a group as Open, Approval Needed, or Invite-Only according to the purpose of that group."
      },
      {
        "question": "Will everyone see the same groups?",
        "answer": "Not always. What you can discover or open depends on the group’s privacy settings, your membership status, invitations, and leadership access."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "inbox-announcements-notifications",
    "audience": "member",
    "icon": "🔔",
    "title": "Notification Center & Preferences",
    "items": [
      {
        "question": "What is the Notification Center?",
        "answer": "The Notification Center brings together Portal notifications and important updates meant for you."
      },
      {
        "question": "What notification preferences can I choose?",
        "answer": "Available preferences can include Prayer & Daily Growth, Journey Progress & Next Steps, Events & Formation, Membership & Community, Ministry & Servant Journey, Prayer Partner, and Games & Growth Activities."
      },
      {
        "question": "Can I choose Push or Email notifications?",
        "answer": "Yes, when those channels are available for your account and device. You can control eligible Push and Email notification preferences in your Profile."
      },
      {
        "question": "What are prayer reminder time and quiet hours?",
        "answer": "Prayer reminder time helps you choose a preferred time for supported prayer reminders. Quiet hours help reduce eligible notifications during the time period you choose."
      },
      {
        "question": "Why am I not receiving Push notifications on iPhone?",
        "answer": "For supported iPhone Push notifications, first add the Community Portal to your Home Screen and use the installed app. Also make sure notifications are allowed for the Portal on that device."
      },
      {
        "question": "What should I do after changing devices or browser settings?",
        "answer": "Open the Portal on the new or updated device, review Notification Preferences, and allow Push again if the device needs a new notification subscription."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "worship-hub",
    "audience": "member",
    "icon": "🎵",
    "title": "Worship Hub",
    "items": [
      {
        "question": "What is the Worship Hub?",
        "answer": "The Worship Hub brings together worship resources that are available to your account, such as songs, setlists, keys, tempo information, media, and chord resources."
      },
      {
        "question": "Why can’t I see every Worship Hub feature?",
        "answer": "Some worship resources may be shown only to members who need them for their ministry or role."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "faith-quest-challenge",
    "audience": "member",
    "icon": "✝",
    "title": "Faith Quest Challenge",
    "items": [
      {
        "question": "What is Faith Quest Challenge?",
        "answer": "Faith Quest Challenge is our faith-learning game area. It is for Bible, Scripture, Catechism, theology, and other Christian learning activities."
      },
      {
        "question": "What kind of activities will I find here?",
        "answer": "You may find quizzes, memory challenges, Bible questions, Catechism topics, and other fun ways to learn more about the Christian faith."
      },
      {
        "question": "Can Faith Quest Challenge have scores or rankings?",
        "answer": "Yes. Some challenges may give scores, points, or rankings so members can enjoy learning together in a fun and friendly way."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "sports-fitness",
    "audience": "member",
    "icon": "🏃",
    "title": "Sports & Fitness",
    "items": [
      {
        "question": "What is Sports & Fitness?",
        "answer": "Sports & Fitness is for movement, exercise, wellness, and sports-related activities."
      },
      {
        "question": "Can Sports & Fitness activities have points or scores?",
        "answer": "Yes, when a particular activity includes scoring, progress, or a friendly ranking."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "fog-arcade",
    "audience": "member",
    "icon": "🎮",
    "title": "FOG Arcade",
    "items": [
      {
        "question": "What is FOG Arcade?",
        "answer": "FOG Arcade is the Community Portal’s digital game area for fun games and eSports-style activities."
      },
      {
        "question": "Can I play an Arcade game again?",
        "answer": "Yes, when replay is available. After a game, you may see options to play again, return to the Arcade, save a score, or share your result."
      },
      {
        "question": "Do all Arcade games have a leaderboard?",
        "answer": "No. Only games that are connected to scoring or rankings will appear on a leaderboard."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "profile-member-directory",
    "audience": "member",
    "icon": "🪪",
    "title": "Profile & Member Directory",
    "items": [
      {
        "question": "What is my Profile?",
        "answer": "Your Profile is your personal member area. It may contain your basic information, profile picture, member details, email status, notification preferences, and settings that are available for you to manage."
      },
      {
        "question": "What is the Member Directory?",
        "answer": "The Member Directory helps people in the community find member information that has been approved for appropriate community use."
      },
      {
        "question": "Can everyone see all my information?",
        "answer": "No. The Portal should only show information that is appropriate for the person viewing it and the purpose of that feature."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "sharing",
    "audience": "public",
    "icon": "↗",
    "title": "Sharing",
    "items": [
      {
        "question": "How do I share an event or game result?",
        "answer": "Tap the Share button when you see it. Your phone may open its normal sharing choices, or the Portal may let you copy a link."
      },
      {
        "question": "Does sharing a link give someone access to my account?",
        "answer": "No. A normal shared link should not include your password or private sign-in information."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "install-on-phone-offline-use",
    "audience": "public",
    "icon": "📱",
    "title": "Install on Phone & Offline Use",
    "items": [
      {
        "question": "How do I add the Community Portal to my phone?",
        "answer": "Open the Portal in your phone’s browser and use the browser’s option to add it to your Home Screen."
      },
      {
        "question": "Can I use the Portal without internet?",
        "answer": "Some parts may still be available when your connection drops, but anything that needs fresh information or saves a new change may need internet access."
      },
      {
        "question": "What should I do after reconnecting?",
        "answer": "Open the Portal again and allow it to reconnect normally. If something still looks outdated, refresh the page."
      }
    ],
    "permissionAny": [],
    "permissionAll": []
  },
  {
    "id": "leader-help-events-attendance-roles",
    "audience": "leader",
    "icon": "📋",
    "title": "Leader Help: Events, Attendance & Roles",
    "items": [
      {
        "question": "What can leaders manage for events?",
        "answer": "Depending on their permission, leaders may be able to help prepare event information, review registrations, check attendance, see turnout, and manage assigned roles."
      },
      {
        "question": "Why can’t I see an event-management choice?",
        "answer": "Some choices are shown only to leaders who have been given permission to use them."
      }
    ],
    "permissionAny": [
      "access_events",
      "access_attendance",
      "access_checkin"
    ],
    "permissionAll": []
  },
  {
    "id": "leader-help-ministries-availability",
    "audience": "leader",
    "icon": "🙌",
    "title": "Leader Help: Ministries & Availability",
    "items": [
      {
        "question": "What can ministry leaders manage?",
        "answer": "Depending on their permission, ministry leaders may be able to view membership, roles, service interest, and availability needed for ministry planning."
      },
      {
        "question": "Can every leader change every ministry?",
        "answer": "No. Access should follow the permission given to that leader."
      }
    ],
    "permissionAny": [
      "access_ministries"
    ],
    "permissionAll": []
  },
  {
    "id": "leader-help-announcements-broadcasts",
    "audience": "leader",
    "icon": "📣",
    "title": "Leader Help: Announcements & Broadcasts",
    "items": [
      {
        "question": "Who can send community announcements?",
        "answer": "Only people who have been given the right permission should be able to send announcements or broadcasts."
      },
      {
        "question": "What should I check before sending an announcement?",
        "answer": "Check the message, the people who should receive it, and whether the information is appropriate to share before you send it."
      }
    ],
    "permissionAny": [
      "access_communications"
    ],
    "permissionAll": []
  },
  {
    "id": "leader-help-worship-resources",
    "audience": "leader",
    "icon": "🎼",
    "title": "Leader Help: Worship Resources",
    "items": [
      {
        "question": "What can worship leaders manage?",
        "answer": "Depending on their permission, worship leaders may be able to prepare song resources, setlists, keys, tempo information, media, and chord references."
      },
      {
        "question": "Why are some worship choices hidden?",
        "answer": "Some choices are meant only for the people responsible for preparing or leading worship."
      }
    ],
    "permissionAny": [
      "access_worship"
    ],
    "permissionAll": []
  },
  {
    "id": "leader-help-discipleship-groups-growth",
    "audience": "leader",
    "icon": "🔥",
    "title": "Leader Help: Discipleship, Groups & Growth",
    "items": [
      {
        "question": "What can authorized Discipleship leaders manage?",
        "answer": "Depending on their permissions, authorized leaders may manage Campfires and Fire Circles, group leaders, privacy, membership workflows, Daily Habit settings, Weekly Challenges, and other discipleship tools available to their role."
      },
      {
        "question": "How should I choose between Campfire and Fire Circle?",
        "answer": "Choose Campfire for a dynamic prayer or sharing group whose membership may change. Choose Fire Circle for a stable long-term discipleship group intended to journey together over time."
      },
      {
        "question": "Does changing a group type automatically move members?",
        "answer": "No. Group Type is an identity for the group. Changing Campfire or Fire Circle does not automatically reassign members, change privacy, or change the group’s existing membership."
      },
      {
        "question": "What can leaders manage for Weekly Challenges?",
        "answer": "Authorized leaders can view challenges, create new challenges, edit existing challenge details and Life Points, change active status, and archive challenges according to their permissions."
      },
      {
        "question": "Should Growth Journey controls be used as a spiritual ranking?",
        "answer": "No. Leadership Journey controls are for pastoral guidance, formation, and appropriate progression. They should never be used to rank a person’s holiness, worth, or importance in the community."
      }
    ],
    "permissionAny": [
      "access_discipleship"
    ],
    "permissionAll": []
  },
  {
    "id": "administrator-help-accounts-permissions",
    "audience": "admin",
    "icon": "⚙️",
    "title": "Administrator Help: Accounts & Permissions",
    "items": [
      {
        "question": "What are permissions?",
        "answer": "Permissions decide which special parts of the Community Portal a person is allowed to use."
      },
      {
        "question": "Why should permissions be given carefully?",
        "answer": "Some parts of the Portal can change member information, events, ministry information, or community messages. They should only be available to people who need them."
      },
      {
        "question": "Can hiding a button by itself protect an admin feature?",
        "answer": "No. The Portal must also check the person’s permission before allowing the action, even if someone tries to open the page or action directly."
      }
    ],
    "permissionAny": [
      "access_permissions"
    ],
    "permissionAll": []
  }
].map(section => Object.freeze({
    ...section,
    permissionAny: Object.freeze(section.permissionAny),
    permissionAll: Object.freeze(section.permissionAll),
    items: Object.freeze(section.items.map(item => Object.freeze(item)))
})));

const FAQ_PREVIEW_PROFILES = Object.freeze(new Set(["guest", "member", "leader", "administrator"]));

function isFaqSectionAllowed(section, access = {}) {
    const preview = access.preview || null;
    if (preview === "administrator") return true;
    if (preview === "leader") return section.audience !== "admin";
    if (preview === "member") return section.audience === "public" || section.audience === "member";
    if (preview === "guest") return section.audience === "public";

    if (section.audience === "public") return true;
    if (!access.authenticated) return false;
    if (section.audience === "member") return true;
    if (access.isAdministrator) return true;

    const hasPermission = typeof access.hasPermission === "function"
        ? access.hasPermission
        : () => false;
    if (section.permissionAny.length === 0 && section.permissionAll.length === 0) return false;
    const anySatisfied = section.permissionAny.length === 0 ||
        section.permissionAny.some(permission => hasPermission(permission));
    const allSatisfied = section.permissionAll.every(permission => hasPermission(permission));
    return anySatisfied && allSatisfied;
}

function getFaqSectionsForAccess(access = {}) {
    if (access.preview && !FAQ_PREVIEW_PROFILES.has(access.preview)) {
        throw new TypeError("Unknown FAQ preview profile");
    }
    return FAQ_SECTIONS
        .filter(section => isFaqSectionAllowed(section, access))
        .map(section => ({
            id: section.id,
            audience: section.audience,
            icon: section.icon,
            title: section.title,
            items: section.items.map(item => ({ ...item }))
        }));
}

module.exports = {
    FAQ_PREVIEW_PROFILES,
    FAQ_SECTIONS,
    getFaqSectionsForAccess,
    isFaqSectionAllowed
};
