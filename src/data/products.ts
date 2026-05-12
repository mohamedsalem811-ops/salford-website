// ─── Salford Libya — Real Product Data ───────────────────────────────────────
export interface Product {
  id: string;
  code: string;
  isSet: boolean;
  setCodes?: string[];
  name: string;
  category: 'necklaces' | 'earrings' | 'bracelets' | 'rings' | 'sets';
  price: number;
  originalPrice?: number;
  image: string;           // user-provided image URL
  images: string[];        // additional high-quality images from swarovski
  description: string;
  shortDesc: string;
  inStock: boolean;
  quantity: number;
  featured: boolean;
  setItems?: string[];     // names of items in a set
}

export interface SiteSettings {
  storeName: string;
  facebookUrl: string;
  instagramUrl: string;
  whatsappNumber: string;
  heroTitleAr: string;
  heroTitleEn: string;
  heroSubtitleAr: string;
  heroSubtitleEn: string;
  adminUser: string;
  adminPass: string;
  currency: string;
}

// ─── IN-MEMORY STORE ─────────────────────────────────────────────────────────
let products: Product[] = [
  // ── 1. Iconic Swan Stud Earrings (gradient pink/champagne)
  {
    id: '1', code: '5512850', isSet: false,
    name: 'Iconic Swan Stud Earrings',
    category: 'earrings', price: 500,
    image: 'https://www.genspark.ai/api/files/s/X9PzkTE4',
    images: [
      'https://www.genspark.ai/api/files/s/X9PzkTE4',
      'https://image.swarovski.net/Content/Images/Product/FullSize/5512850-01.jpg',
      'https://image.swarovski.net/Content/Images/Product/FullSize/5512850-03.jpg',
    ],
    description: 'Graceful and radiant, these iconic swan stud earrings feature the beloved swan motif in a beautiful gradient of clear, pink and champagne crystals using pavé crystal embellishment. The silver-tone rhodium-plated finish adds a touch of timeless elegance, making these the perfect everyday accessory.',
    shortDesc: 'Swan pavé studs, pink-champagne gradient, rhodium plated',
    inStock: true, quantity: 10, featured: true,
  },
  // ── 2. Angelic Bracelet (round pavé silver tennis)
  {
    id: '2', code: '5505471', isSet: false,
    name: 'Angelic Bracelet',
    category: 'bracelets', price: 680,
    image: 'https://www.genspark.ai/api/files/s/kDmmhajD',
    images: [
      'https://www.genspark.ai/api/files/s/kDmmhajD',
      'https://image.swarovski.net/Content/Images/Product/FullSize/5505471-01.jpg',
      'https://image.swarovski.net/Content/Images/Product/FullSize/5505471-02.jpg',
    ],
    description: 'Radiate elegance with this luminous Angelic bracelet. The rhodium-plated design features individual links, each set with a brilliant central crystal surrounded by a halo of smaller round-cut pavé crystals. An ethereally elegant, timeless piece for every occasion.',
    shortDesc: 'Round-cut halo links tennis bracelet, rhodium plated',
    inStock: true, quantity: 8, featured: true,
  },
  // ── 3. Hello Kitty Pendant Necklace (pink heart, silver)
  {
    id: '3', code: '5572095', isSet: false,
    name: 'Hello Kitty Pendant Necklace',
    category: 'necklaces', price: 450,
    image: 'https://www.genspark.ai/api/files/s/qXJUqP6v',
    images: [
      'https://www.genspark.ai/api/files/s/qXJUqP6v',
      'https://image.swarovski.net/Content/Images/Product/FullSize/5572095-01.jpg',
    ],
    description: 'Adorable meets luxurious in this charming Hello Kitty pendant necklace. The iconic character is rendered in sparkling clear crystal pavé with a pink heart crystal and pink bow, suspended on a fine silver-tone rhodium-plated chain. A playful yet sophisticated piece.',
    shortDesc: 'Hello Kitty pavé pendant, pink heart, rhodium plated',
    inStock: true, quantity: 5, featured: false,
  },
  // ── 4. Sparkling Dance Round Necklace (pink, rose gold)
  {
    id: '4', code: '5514488', isSet: false,
    name: 'Sparkling Dance Round Necklace',
    category: 'necklaces', price: 580,
    image: 'https://www.genspark.ai/api/files/s/fS2aKXdZ',
    images: [
      'https://www.genspark.ai/api/files/s/fS2aKXdZ',
      'https://image.swarovski.net/Content/Images/Product/FullSize/5514488-01.jpg',
      'https://image.swarovski.net/Content/Images/Product/FullSize/5514488-02.jpg',
    ],
    description: 'Inspired by the idea of a dancing crystal, this elegant rose gold-plated necklace features a large round pink stone at the center, beautifully framed with sparkling clear crystal pavé in a circular cage setting. A feminine, eye-catching statement piece.',
    shortDesc: 'Round pink crystal pendant in pavé cage, rose gold plated',
    inStock: true, quantity: 7, featured: true,
  },
  // ── 5. Iconic Swan Pendant Necklace (white crystal, silver)
  {
    id: '5', code: '5416604', isSet: false,
    name: 'Iconic Swan Pendant Necklace',
    category: 'necklaces', price: 520,
    image: 'https://www.genspark.ai/api/files/s/0WelYyel',
    images: [
      'https://www.genspark.ai/api/files/s/0WelYyel',
      'https://image.swarovski.net/Content/Images/Product/FullSize/5416604-01.jpg',
      'https://image.swarovski.net/Content/Images/Product/FullSize/5416604-02.jpg',
    ],
    description: 'The quintessential Swarovski swan takes center stage in this elegant pendant necklace. The graceful swan motif is embellished with shimmering clear crystal pavé, finished in rhodium-plated silver tone. Delicate and iconic, it is a piece to be treasured forever.',
    shortDesc: 'Swan pavé pendant, clear crystals, rhodium plated',
    inStock: true, quantity: 12, featured: true,
  },
  // ── 6. Iconic Swan Bracelet (red crystal, gold cord)
  {
    id: '6', code: '5465403', isSet: false,
    name: 'Iconic Swan Bracelet',
    category: 'bracelets', price: 480,
    image: 'https://www.genspark.ai/api/files/s/U4egGAcL',
    images: [
      'https://www.genspark.ai/api/files/s/U4egGAcL',
      'https://image.swarovski.net/Content/Images/Product/FullSize/5465403-01.jpg',
    ],
    description: 'A vivacious statement piece, this iconic swan bracelet combines a gold-tone chain with a vibrant red cotton cord. The centrepiece red crystal swan is set in Pointiage® technique, creating a bold and striking look. Perfect for gifting or adding a pop of colour to any outfit.',
    shortDesc: 'Red crystal swan on gold chain & red cord',
    inStock: true, quantity: 6, featured: false,
  },
  // ── 7. Attract Soul Bangle (heart bangle, silver)
  {
    id: '7', code: '5535264', isSet: false,
    name: 'Attract Soul Bangle',
    category: 'bracelets', price: 620,
    image: 'https://www.genspark.ai/api/files/s/712a54QR',
    images: [
      'https://www.genspark.ai/api/files/s/712a54QR',
      'https://image.swarovski.net/Content/Images/Product/FullSize/5535264-01.jpg',
      'https://image.swarovski.net/Content/Images/Product/FullSize/5535264-02.jpg',
    ],
    description: 'Make a bold statement with this striking open bangle. Two large heart-cut clear crystals sit at each end of the smooth rhodium-plated cuff, framed by delicate pavé crystal edges. Modern and romantic, it is the perfect balance of boldness and femininity.',
    shortDesc: 'Open cuff bangle with dual heart crystals, rhodium plated',
    inStock: true, quantity: 4, featured: true,
  },
  // ── 8. Swarovski Infinity Necklace (infinity symbol, silver)
  {
    id: '8', code: '5521346', isSet: false,
    name: 'Infinity Necklace',
    category: 'necklaces', price: 420,
    image: 'https://www.genspark.ai/api/files/s/6Kl8XZNb',
    images: [
      'https://www.genspark.ai/api/files/s/6Kl8XZNb',
      'https://image.swarovski.net/Content/Images/Product/FullSize/5521346-01.jpg',
    ],
    description: 'Representing eternal love and connection, this delicate necklace features a beautiful infinity symbol pendant embellished with sparkling clear crystals and a star accent, suspended on a fine rhodium-plated chain. A meaningful and elegant gift for someone special.',
    shortDesc: 'Crystal infinity symbol pendant, rhodium plated',
    inStock: true, quantity: 9, featured: false,
  },
  // ── 9. Salford Exclusive Pink Heart Earrings (Salford box)
  {
    id: '9', code: '5657854', isSet: false,
    name: 'Crystal Heart Drop Earrings',
    category: 'earrings', price: 390,
    image: 'https://www.genspark.ai/api/files/s/6m9DFiw3',
    images: [
      'https://www.genspark.ai/api/files/s/6m9DFiw3',
    ],
    description: 'Enchanting and feminine, these crystal heart drop earrings feature a pink pavé crystal heart stud with a delicate flower-shaped dangling drop in peach-pink crystals, finished in a rose gold-tone setting. Exclusive to Salford Libya — the perfect gift presented in our signature pink box.',
    shortDesc: 'Pink heart pavé stud with flower drop, rose gold plated',
    inStock: true, quantity: 8, featured: true,
  },
  // ── 10. Matrix Tennis Bracelet (yellow crystal, gold)
  {
    id: '10', code: '5648937', isSet: false,
    name: 'Matrix Tennis Bracelet',
    category: 'bracelets', price: 750,
    image: 'https://www.genspark.ai/api/files/s/VV7kfQC1',
    images: [
      'https://www.genspark.ai/api/files/s/VV7kfQC1',
      'https://image.swarovski.net/Content/Images/Product/FullSize/5648937-01.jpg',
    ],
    description: 'Luminous and luxurious, this tennis bracelet features a continuous row of round yellow crystals in a rich gold-tone setting. Combining opulence with modern style, this piece radiates confidence and sophistication. An iconic everyday luxury.',
    shortDesc: 'Round yellow crystals tennis bracelet, gold plated',
    inStock: true, quantity: 5, featured: true,
  },
  // ── 11. Iconic Swan Necklace (red crystal, gold tone)
  {
    id: '11', code: '5647583', isSet: false,
    name: 'Iconic Swan Necklace — Red',
    category: 'necklaces', price: 650,
    image: 'https://www.genspark.ai/api/files/s/72VLZOnH',
    images: [
      'https://www.genspark.ai/api/files/s/72VLZOnH',
      'https://image.swarovski.net/Content/Images/Product/FullSize/5647583-01.jpg',
    ],
    description: 'Bold and striking, this elegant necklace features our legendary swan motif set entirely in vibrant red crystal Pointiage®, suspended from a gold-tone chain with pearl-like bead accents. A head-turning piece that celebrates Swarovski\'s iconic heritage with passionate energy.',
    shortDesc: 'Red crystal swan pendant, pearl accents, gold plated',
    inStock: true, quantity: 4, featured: false,
  },
  // ── 12. Swan Pendant Necklace (large white baguette, silver)
  {
    id: '12', code: '5648750', isSet: false,
    name: 'Swan Pendant Necklace — Grand',
    category: 'necklaces', price: 980,
    image: 'https://www.genspark.ai/api/files/s/Mw8Vm2Fj',
    images: [
      'https://www.genspark.ai/api/files/s/Mw8Vm2Fj',
      'https://image.swarovski.net/Content/Images/Product/FullSize/5648750-01.jpg',
    ],
    description: 'A breathtaking statement necklace featuring an elaborate, large-format swan rendered in mixed-cut crystals including baguettes and pavé, with pearl-like bead accents and a dramatic teardrop pear-cut crystal drop. Rhodium-plated and utterly spectacular — for those who love to shine.',
    shortDesc: 'Large mixed-cut swan pendant, baguette & pavé crystals, rhodium',
    inStock: true, quantity: 3, featured: true,
  },
  // ── 13. Swan Pendant Necklace (pink, rose gold)
  {
    id: '13', code: '5647589', isSet: false,
    name: 'Swan Pendant Necklace — Pink',
    category: 'necklaces', price: 720,
    image: 'https://www.genspark.ai/api/files/s/P2TUrhjE',
    images: [
      'https://www.genspark.ai/api/files/s/P2TUrhjE',
      'https://image.swarovski.net/Content/Images/Product/FullSize/5647589-01.jpg',
    ],
    description: 'Romantic and radiant, this rose gold-plated swan pendant necklace showcases the iconic swan in clear and pink crystal mixed-cut pavé with a central pink pear-shaped crystal. An exquisite blend of whimsy and luxury.',
    shortDesc: 'Swan with pink pear crystal, mixed-cut pavé, rose gold plated',
    inStock: true, quantity: 6, featured: true,
  },
  // ── 14. Swan Drop Earrings (black crystal, pearl drop)
  {
    id: '14', code: '5193949', isSet: false,
    name: 'Iconic Swan Drop Earrings — Black',
    category: 'earrings', price: 560,
    image: 'https://www.genspark.ai/api/files/s/dKGxux1b',
    images: [
      'https://www.genspark.ai/api/files/s/dKGxux1b',
      'https://image.swarovski.net/Content/Images/Product/FullSize/5193949-01.jpg',
    ],
    description: 'Drama meets elegance in these striking drop earrings featuring black crystal pavé swan motifs with large, lustrous white imitation pearl drops. The rose gold-tone finish adds warmth to this bold, sophisticated design — perfect for making an unforgettable impression.',
    shortDesc: 'Black swan pavé studs with pearl drop, rose gold plated',
    inStock: true, quantity: 5, featured: false,
  },
  // ── 15. Iconic Swan Necklace (gradient, silver in box)
  {
    id: '15', code: '5647897', isSet: false,
    name: 'Iconic Swan Necklace — Gradient',
    category: 'necklaces', price: 600,
    image: 'https://www.genspark.ai/api/files/s/68gyxYSI',
    images: [
      'https://www.genspark.ai/api/files/s/68gyxYSI',
    ],
    description: 'The beloved swan rendered in a beautiful gradient from clear to warm champagne crystals — a timeless keepsake presented in Swarovski\'s signature white gift box. Perfect as a gift for someone you love.',
    shortDesc: 'Swan gradient crystal pendant, silver tone, gift boxed',
    inStock: true, quantity: 7, featured: false,
  },
  // ── 16. Dazzling Swan Necklace (pink crystal, rose gold in box)
  {
    id: '16', code: '5469989', isSet: false,
    name: 'Dazzling Swan Necklace — Pink',
    category: 'necklaces', price: 640,
    image: 'https://www.genspark.ai/api/files/s/4zBNSlHS',
    images: [
      'https://www.genspark.ai/api/files/s/4zBNSlHS',
    ],
    description: 'Dazzling and feminine, this swan necklace features a pavé crystal swan with a vibrant pink triangular crystal body at its heart, on a rose gold-plated chain. Gift-boxed in Swarovski\'s signature white presentation box — a truly special treasure.',
    shortDesc: 'Swan with pink crystal body, pavé halo, rose gold plated',
    inStock: true, quantity: 6, featured: true,
  },
  // ── 17. Dazzling Swan Necklace (blue crystal, silver in box)
  {
    id: '17', code: '5469990', isSet: false,
    name: 'Dazzling Swan Necklace — Blue',
    category: 'necklaces', price: 640,
    image: 'https://www.genspark.ai/api/files/s/OEOVOzVo',
    images: [
      'https://www.genspark.ai/api/files/s/OEOVOzVo',
    ],
    description: 'Captivating and cool, this swan necklace features a pavé crystal swan with a brilliant blue triangular crystal body, on a rhodium-plated silver-tone chain. Presented in Swarovski\'s signature white gift box — an exceptional gift for any occasion.',
    shortDesc: 'Swan with blue crystal body, pavé halo, rhodium plated',
    inStock: true, quantity: 5, featured: false,
  },
  // ── 18. Teddy Bear Pendant Necklace (pink crystal, rose gold in box)
  {
    id: '18', code: '5642976', isSet: false,
    name: 'Teddy Pendant Necklace',
    category: 'necklaces', price: 550,
    image: 'https://www.genspark.ai/api/files/s/FlfV5MUB',
    images: [
      'https://www.genspark.ai/api/files/s/FlfV5MUB',
      'https://www.swarovski.com/dw/image/v2/AATB_PRD/on/demandware.static/-/Sites-swarovski-master/default/dw6b5a5c7c/images/large/5642976_0.jpg',
    ],
    description: 'Inspire a smile with this playful Teddy pendant necklace. The 3D teddy bear is covered in light pink crystal Pointiage® and holds a heart-shaped "dancing" stone in vibrant pink, finished with a rose gold-tone plated chain. Presented in Swarovski gift box.',
    shortDesc: '3D teddy bear, pink crystal Pointiage, dancing heart stone',
    inStock: true, quantity: 8, featured: true,
  },
  // ── 19. Teddy Bracelet (blue, silver)
  {
    id: '19', code: '5643571', isSet: false,
    name: 'Teddy Bracelet — Blue',
    category: 'bracelets', price: 430,
    image: 'https://www.genspark.ai/api/files/s/kqnsWEVv',
    images: [
      'https://www.genspark.ai/api/files/s/kqnsWEVv',
    ],
    description: 'Fun and playful, this Teddy bracelet features an adorable 3D bear motif covered in aquamarine blue crystal pavé with cool sunglasses detail, threaded on a vibrant turquoise cotton cord with silver-tone fittings. The perfect accessory for the young at heart.',
    shortDesc: '3D blue crystal teddy bear on turquoise cord',
    inStock: true, quantity: 6, featured: false,
  },
  // ── 20. Swan Drop Earrings (blue crystal, silver hoops)
  {
    id: '20', code: '5678055', isSet: false,
    name: 'Swan Drop Earrings — Blue',
    category: 'earrings', price: 710,
    image: 'https://www.genspark.ai/api/files/s/7J0MdSeS',
    images: [
      'https://www.genspark.ai/api/files/s/7J0MdSeS',
      'https://image.swarovski.net/Content/Images/Product/FullSize/5678055-01.jpg',
    ],
    description: 'Stunning and dramatic, these swan drop earrings feature graceful blue crystal pavé swans with layered wing details, hanging from crystal-embellished rhodium-plated hoops with sparkling teardrop crystal drops. A statement piece for any evening occasion.',
    shortDesc: 'Blue swan pavé drops on crystal hoops, rhodium plated',
    inStock: true, quantity: 4, featured: true,
  },
  // ── 21. Infinity Necklace (rose gold infinity symbol in box)
  {
    id: '21', code: '5518865', isSet: false,
    name: 'Infinity Necklace — Rose Gold',
    category: 'necklaces', price: 460,
    image: 'https://www.genspark.ai/api/files/s/SkFZct0P',
    images: [
      'https://www.genspark.ai/api/files/s/SkFZct0P',
    ],
    description: 'Symbolising infinite love and connection, this infinity necklace features a sparkling rose gold-plated infinity pendant set with clear crystals. Presented in Swarovski\'s signature gift box, it makes a perfect romantic gift.',
    shortDesc: 'Crystal infinity pendant, rose gold plated, gift boxed',
    inStock: true, quantity: 10, featured: false,
  },
  // ── 22. Angelic Bracelet Gold (round crystal, gold plated)
  {
    id: '22', code: '5237769', isSet: false,
    name: 'Angelic Bracelet — Gold',
    category: 'bracelets', price: 700,
    image: 'https://www.genspark.ai/api/files/s/xyqBhvwA',
    images: [
      'https://www.genspark.ai/api/files/s/xyqBhvwA',
      'https://image.swarovski.net/Content/Images/Product/FullSize/5237769-01.jpg',
    ],
    description: 'Radiate luxury with this Angelic bracelet in a warm gold-tone plated finish. Each link features a brilliant central crystal surrounded by a halo of smaller pavé crystals, joined by polished gold spherical link accents. A statement of pure elegance.',
    shortDesc: 'Round-cut halo links tennis bracelet, gold plated',
    inStock: true, quantity: 5, featured: false,
  },
  // ── 23. Dazzling Swan Necklace (red, rose gold)
  {
    id: '23', code: '5647592', isSet: false,
    name: 'Dazzling Swan Necklace — Red',
    category: 'necklaces', price: 660,
    image: 'https://www.genspark.ai/api/files/s/xJWzLu5i',
    images: [
      'https://www.genspark.ai/api/files/s/xJWzLu5i',
    ],
    description: 'Passion meets artistry in this dazzling rose gold-plated swan necklace. The iconic swan silhouette is outlined in clear crystal pavé, with a dramatic red pear-shaped crystal forming the swan\'s body. A breathtaking piece full of personality.',
    shortDesc: 'Swan with red pear crystal, pavé outline, rose gold plated',
    inStock: true, quantity: 4, featured: false,
  },
  // ── 24. Teddy Pendant (blue, silver chain on model)
  {
    id: '24', code: '5647434', isSet: false,
    name: 'Teddy Pendant Necklace — Blue',
    category: 'necklaces', price: 480,
    image: 'https://www.genspark.ai/api/files/s/h6SxLsu7',
    images: [
      'https://www.genspark.ai/api/files/s/h6SxLsu7',
    ],
    description: 'Charming and whimsical, this Teddy pendant necklace features a cute 3D bear character in aquamarine blue crystal pavé with playful glasses detail, suspended on a silver-tone rectangular link chain. A unique conversation piece that radiates fun and individuality.',
    shortDesc: '3D blue crystal teddy with glasses, silver link chain',
    inStock: true, quantity: 6, featured: false,
  },
  // ── 25. Swan Drop Earrings (pink, rose gold hoops)
  {
    id: '25', code: '5678050', isSet: false,
    name: 'Swan Drop Earrings — Pink',
    category: 'earrings', price: 730,
    image: 'https://www.genspark.ai/api/files/s/YM1Ty6F3',
    images: [
      'https://www.genspark.ai/api/files/s/YM1Ty6F3',
    ],
    description: 'Utterly magnificent and romantic, these large swan drop earrings feature full-body pink crystal pavé swans with layered wing details and enamel accents, hanging from crystal-embellished rose gold-plated hoops. The ultimate statement earring for special occasions.',
    shortDesc: 'Large pink swan pavé drops on crystal hoops, rose gold plated',
    inStock: true, quantity: 3, featured: true,
  },
  // ── 26. Infinity Heart Necklace (rose gold + heart in box)
  {
    id: '26', code: '5518868', isSet: false,
    name: 'Infinity Heart Necklace',
    category: 'necklaces', price: 490,
    image: 'https://www.genspark.ai/api/files/s/WAtVRVrS',
    images: [
      'https://www.genspark.ai/api/files/s/WAtVRVrS',
    ],
    description: 'A celebration of eternal love, this rose gold-plated necklace combines an infinity symbol with an open heart in sparkling clear crystal pavé. Presented in Swarovski\'s signature gift box, it\'s the perfect romantic gesture for any occasion.',
    shortDesc: 'Infinity & heart crystal pendant, rose gold plated, gift boxed',
    inStock: true, quantity: 8, featured: true,
  },
  // ── 27. Tennis Deluxe Bracelet (white, silver)
  {
    id: '27', code: '5409771', isSet: false,
    name: 'Tennis Deluxe Bracelet',
    category: 'bracelets', price: 820,
    image: 'https://www.genspark.ai/api/files/s/el9bc52j',
    images: [
      'https://www.genspark.ai/api/files/s/el9bc52j',
      'https://image.swarovski.net/Content/Images/Product/FullSize/5409771-01.jpg',
    ],
    description: 'The epitome of timeless elegance — this iconic Tennis Deluxe bracelet features a continuous line of individually set round-cut white crystals in rhodium-plated settings. Classic, refined and endlessly versatile, it is a jewellery wardrobe essential.',
    shortDesc: 'Continuous round-cut white crystals, slim tennis, rhodium plated',
    inStock: true, quantity: 7, featured: true,
  },
  // ── SETS ──────────────────────────────────────────────────────────────────
  // ── SET A: Swan Classic Set (necklace 5 + earrings 1)
  {
    id: '101', code: '5416604+5512850', isSet: true,
    setCodes: ['5416604', '5512850'],
    name: 'Iconic Swan Set — Classic',
    category: 'sets', price: 900, originalPrice: 1020,
    image: 'https://www.genspark.ai/api/files/s/0WelYyel',
    images: [
      'https://www.genspark.ai/api/files/s/0WelYyel',
      'https://www.genspark.ai/api/files/s/X9PzkTE4',
    ],
    description: 'The perfect Swarovski duo — our beloved Iconic Swan Pendant Necklace paired with the gradient Iconic Swan Stud Earrings. Together they create a complete, harmonious swan look radiating elegance. Save 120 LYD when you buy as a set.',
    shortDesc: 'Swan Pendant Necklace + Swan Stud Earrings',
    setItems: ['Iconic Swan Pendant Necklace (5416604)', 'Iconic Swan Stud Earrings (5512850)'],
    inStock: true, quantity: 5, featured: true,
  },
  // ── SET B: Teddy Bear Set (necklace 18 + bracelet 19)
  {
    id: '102', code: '5642976+5643571', isSet: true,
    setCodes: ['5642976', '5643571'],
    name: 'Teddy Bear Set',
    category: 'sets', price: 850, originalPrice: 980,
    image: 'https://www.genspark.ai/api/files/s/FlfV5MUB',
    images: [
      'https://www.genspark.ai/api/files/s/FlfV5MUB',
      'https://www.genspark.ai/api/files/s/kqnsWEVv',
    ],
    description: 'The cutest duo in the collection — the beloved pink Teddy Pendant Necklace paired with the playful blue Teddy Bracelet. A charming gift combination that brings joy and sparkle to any outfit. Save 130 LYD when you buy as a set.',
    shortDesc: 'Teddy Pendant Necklace (pink) + Teddy Bracelet (blue)',
    setItems: ['Teddy Pendant Necklace — Pink (5642976)', 'Teddy Bracelet — Blue (5643571)'],
    inStock: true, quantity: 4, featured: true,
  },
  // ── SET C: Dazzling Swan Set (pink necklace 16 + pink earrings 25)
  {
    id: '103', code: '5469989+5678050', isSet: true,
    setCodes: ['5469989', '5678050'],
    name: 'Dazzling Swan Set — Pink',
    category: 'sets', price: 1200, originalPrice: 1370,
    image: 'https://www.genspark.ai/api/files/s/4zBNSlHS',
    images: [
      'https://www.genspark.ai/api/files/s/4zBNSlHS',
      'https://www.genspark.ai/api/files/s/YM1Ty6F3',
    ],
    description: 'Our most glamorous pink set — the breathtaking Dazzling Swan Pink Necklace paired with the magnificent Swan Drop Earrings in Pink. A head-to-toe statement in rose gold and pink crystals. Save 170 LYD when you buy as a set.',
    shortDesc: 'Dazzling Swan Necklace (pink) + Swan Drop Earrings (pink)',
    setItems: ['Dazzling Swan Necklace — Pink (5469989)', 'Swan Drop Earrings — Pink (5678050)'],
    inStock: true, quantity: 3, featured: true,
  },
];

let settings: SiteSettings = {
  storeName: 'Salford Libya',
  facebookUrl: 'https://www.facebook.com/salfordlibya',
  instagramUrl: 'https://www.instagram.com/salford.libya/',
  whatsappNumber: '',
  heroTitleAr: 'مجوهرات فاخرة أصلية',
  heroTitleEn: 'Authentic Luxury Jewelry',
  heroSubtitleAr: 'مجوهرات أصلية من سواروفسكي وبندورا وتيفاني آند كو — جودة مضمونة في كل قطعة',
  heroSubtitleEn: 'Authentic jewelry from Swarovski, Pandora & Tiffany & Co — guaranteed quality in every piece',
  adminUser: 'admin',
  adminPass: 'salford2024',
  currency: 'LYD',
};

// ─── CRUD ─────────────────────────────────────────────────────────────────────
export const getAll = () => products;
export const getById = (id: string) => products.find(p => p.id === id);
export const getSets = () => products.filter(p => p.isSet);
export const getIndividual = () => products.filter(p => !p.isSet);
export const getFeatured = () => products.filter(p => p.featured && !p.isSet);
export const getFeaturedSets = () => products.filter(p => p.featured && p.isSet);
export const byCategory = (cat: string) => products.filter(p => p.category === cat);
export const search = (q: string) =>
  products.filter(p =>
    p.name.toLowerCase().includes(q.toLowerCase()) ||
    p.code.toLowerCase().includes(q.toLowerCase()) ||
    p.shortDesc.toLowerCase().includes(q.toLowerCase())
  );

export const addProduct = (p: Omit<Product, 'id'>) => {
  const id = String(Date.now());
  products.push({ ...p, id });
  return id;
};
export const updateProduct = (id: string, data: Partial<Product>) => {
  const i = products.findIndex(p => p.id === id);
  if (i === -1) return false;
  products[i] = { ...products[i], ...data };
  return true;
};
export const deleteProduct = (id: string) => {
  const before = products.length;
  products = products.filter(p => p.id !== id);
  return products.length < before;
};

export const getSettings = () => settings;
export const updateSettings = (s: Partial<SiteSettings>) => { settings = { ...settings, ...s }; };

export const parseFilename = (filename: string) => {
  const regex = /SWAROVSKI-([^(]+)\((\d+)\)/i;
  const m = filename.match(regex);
  if (!m) return null;
  const codesRaw = m[1].trim();
  const isSet = codesRaw.includes('+');
  const codes = isSet ? codesRaw.split('+').map(c => c.trim()) : [codesRaw];
  return { isSet, codes, price: parseInt(m[2]), code: codesRaw };
};
