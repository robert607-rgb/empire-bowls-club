export const pagePaths = {
  "Home": "/", "About the Club": "/about", "News": "/news",
  "Gallery": "/gallery", "Sponsors": "/sponsors", "Fixtures": "/fixtures",
  "Play bowls": "/play-bowls", "Contact": "/contact",
} as const;
export const descriptions: Record<keyof typeof pagePaths, string> = {
  "Home": "Empire Bowls Club in Greenhithe, Kent. Lawn bowls since 1910.",
  "About the Club": "Discover Empire Bowls Club in Greenhithe: our history, achievements and club champions.",
  "News": "The latest news and updates from Empire Bowls Club in Greenhithe, Kent.",
  "Gallery": "Photos from life on and around the green at Empire Bowls Club in Greenhithe, Kent.",
  "Sponsors": "Meet the sponsors supporting Empire Bowls Club in Greenhithe, Kent.",
  "Fixtures": "View Empire Bowls Club fixtures and published match results.",
  "Play bowls": "Try lawn bowls at Empire Bowls Club in Greenhithe, Kent. Find out about joining and playing.",
  "Contact": "Meet the club committee, contact Empire Bowls Club and find our green on Norton Lane, Greenhithe, Kent, DA9 9XY.",
};
