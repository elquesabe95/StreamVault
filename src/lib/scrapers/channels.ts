export interface TVChannel {
  name: string;
  url: string;
  logo: string;
  category: "Cine" | "Deportes" | "Entretenimiento" | "Noticias" | "Anime";
  headers?: Record<string, string>;
}

export const channels: TVChannel[] = [
  {
    name: "Azteca 7",
    url: "/api/v1/scraper?slug=azteca-7&provider=teleonline",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Azteca_7_2011.svg/1200px-Azteca_7_2011.svg.png",
    category: "Entretenimiento"
  },
  {
    name: "Canal 5",
    url: "/api/v1/scraper?slug=canal-5&provider=teleonline",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Canal_5_M%C3%A9xico.svg/1200px-Canal_5_M%C3%A9xico.svg.png",
    category: "Entretenimiento"
  },
  {
    name: "HBO Premium",
    url: "/api/v1/scraper?slug=hbo&provider=teleonline",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/HBO_logo.svg/1280px-HBO_logo.svg.png",
    category: "Cine"
  },
  {
    name: "Star+",
    url: "/api/v1/scraper?slug=star-plus&provider=teleonline",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Star_Plus_logo.svg/1200px-Star_Plus_logo.svg.png",
    category: "Entretenimiento"
  },
  {
    name: "Discovery Channel",
    url: "/api/v1/scraper?slug=discovery-channel&provider=teleonline",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Discovery_Channel_logo.svg/1200px-Discovery_Channel_logo.svg.png",
    category: "Documentales"
  },
  {
    name: "Disney Channel",
    url: "/api/v1/scraper?slug=disney-channel&provider=teleonline",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Disney_Channel_logo.svg/1200px-Disney_Channel_logo.svg.png",
    category: "Infantil"
  },
  {
    name: "Anime TV",
    url: "/api/v1/scraper?slug=animetv&provider=animux",
    logo: "https://cdn-icons-png.flaticon.com/512/3421/3421634.png",
    category: "Anime"
  }
];
