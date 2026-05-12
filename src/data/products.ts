// Product data store - In-memory database for Cloudflare Workers
export interface ProductComponent {
  productCode: string;
  name: string;
  individualPrice: number;
  images: string[];
}

export interface Product {
  id: string;
  isSet: boolean;
  productCodes: string[];
  brand: string;
  name: string;
  nameAr: string;
  description: string;
  shortDescription: string;
  category: string;
  subCategory?: string;
  price: number;
  currency: string;
  displayPrice: string;
  individualPrices?: number[];
  savings?: number;
  images: string[];
  originalImage: string;
  inStock: boolean;
  quantity: number;
  featured: boolean;
  setComponents?: ProductComponent[];
  createdAt: string;
  updatedAt: string;
}

export interface SiteSettings {
  facebookUrl: string;
  instagramUrl: string;
  whatsappNumber: string;
  heroTitleAr: string;
  heroTitleEn: string;
  heroSubtitleAr: string;
  heroSubtitleEn: string;
  adminUsername: string;
  adminPasswordHash: string;
}

export const defaultSettings: SiteSettings = {
  facebookUrl: "https://www.facebook.com/SalfordLibya",
  instagramUrl: "https://www.instagram.com/SalfordLibya",
  whatsappNumber: "+218911234567",
  heroTitleAr: "سالفورد ليبيا",
  heroTitleEn: "Salford Libya",
  heroSubtitleAr: "وكيل معتمد لمجوهرات سواروفسكي الفاخرة",
  heroSubtitleEn: "Authorized Swarovski Luxury Jewelry Retailer",
  adminUsername: "admin",
  adminPasswordHash: "salford2024"
};

export const sampleProducts: Product[] = [
  {
    id: "1",
    isSet: false,
    productCodes: ["5647946"],
    brand: "SWAROVSKI",
    name: "Iconic Swan Earrings – Pink Gradient",
    nameAr: "أقراط إيكونيك سوان - تدرج وردي",
    description: "Elegant swan stud earrings adorned with beautiful pink-to-white gradient crystals. Each swan is meticulously crafted using Swarovski's signature precision-cut crystals in blush pink, light rose, and clear white tones. Rhodium-plated setting ensures lasting brilliance.",
    shortDescription: "Pink gradient crystal swan stud earrings",
    category: "Earrings",
    price: 420,
    currency: "دينار",
    displayPrice: "420 دينار",
    images: ["https://www.genspark.ai/api/files/s/X9PzkTE4"],
    originalImage: "https://www.genspark.ai/api/files/s/X9PzkTE4",
    inStock: true,
    quantity: 8,
    featured: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "2",
    isSet: false,
    productCodes: ["5688498"],
    brand: "SWAROVSKI",
    name: "Angelic Bracelet – Rhodium Plated",
    nameAr: "سوار أنجيليك - مطلي بالرودينيوم",
    description: "A stunning bracelet featuring alternating oval crystal clusters and polished rhodium-plated beads. The pavé-set round crystals surrounding each center stone create a magnificent display of light and brilliance. Lobster clasp closure for secure wear.",
    shortDescription: "Crystal cluster bracelet with rhodium-plated setting",
    category: "Bracelets",
    price: 550,
    currency: "دينار",
    displayPrice: "550 دينار",
    images: ["https://www.genspark.ai/api/files/s/kDmmhajD"],
    originalImage: "https://www.genspark.ai/api/files/s/kDmmhajD",
    inStock: true,
    quantity: 6,
    featured: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "3",
    isSet: false,
    productCodes: ["5614978"],
    brand: "SWAROVSKI",
    name: "Hello Kitty Pendant Necklace",
    nameAr: "قلادة هيلو كيتي",
    description: "A whimsical Hello Kitty pendant necklace featuring a fully pavé-set crystal figure holding a heart-shaped pink crystal. The adorable character is crafted with white crystals for the body and pink crystals for the signature bow and feet detail. Set on a delicate rhodium-plated chain.",
    shortDescription: "Crystal Hello Kitty pendant with pink heart",
    category: "Necklaces",
    price: 480,
    currency: "دينار",
    displayPrice: "480 دينار",
    images: ["https://www.genspark.ai/api/files/s/qXJUqP6v"],
    originalImage: "https://www.genspark.ai/api/files/s/qXJUqP6v",
    inStock: true,
    quantity: 4,
    featured: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "4",
    isSet: false,
    productCodes: ["5636500"],
    brand: "SWAROVSKI",
    name: "Constella Pendant Necklace – Rose Gold",
    nameAr: "قلادة كونستيلا - روز غولد",
    description: "A captivating pendant necklace featuring a brilliant round-cut raspberry crystal as the centerpiece, surrounded by a halo of clear pavé crystals and elegant square-cut accent stones. Rose gold-plated chain and setting add warmth and luxury.",
    shortDescription: "Raspberry crystal halo pendant, rose gold plated",
    category: "Necklaces",
    price: 520,
    currency: "دينار",
    displayPrice: "520 دينار",
    images: ["https://www.genspark.ai/api/files/s/fS2aKXdZ"],
    originalImage: "https://www.genspark.ai/api/files/s/fS2aKXdZ",
    inStock: true,
    quantity: 5,
    featured: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "5",
    isSet: false,
    productCodes: ["5496080"],
    brand: "SWAROVSKI",
    name: "Swan Iconic Pendant Necklace – White Pearl",
    nameAr: "قلادة سوان أيقونيك - لؤلؤ أبيض",
    description: "A timeless swan pendant necklace adorned with gleaming white crystals and Swarovski pearls. The iconic swan silhouette is faithfully recreated in sparkling clear crystals on a delicate rhodium-plated chain with adjustable clasp.",
    shortDescription: "Crystal swan pendant with pearl accents",
    category: "Necklaces",
    price: 560,
    currency: "دينار",
    displayPrice: "560 دينار",
    images: ["https://www.genspark.ai/api/files/s/0WelYyel"],
    originalImage: "https://www.genspark.ai/api/files/s/0WelYyel",
    inStock: true,
    quantity: 7,
    featured: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "6",
    isSet: false,
    productCodes: ["5534847"],
    brand: "SWAROVSKI",
    name: "Iconic Swan Bracelet – Red & Gold",
    nameAr: "سوار سوان أيقونيك - أحمر وذهبي",
    description: "A bold and beautiful dual-strand bracelet combining a red pavé-set crystal swan charm with a gold-plated chain strand and a vibrant red cord strand. The contrasting materials create a striking contemporary look. The swan charm is set with deep red Swarovski crystals.",
    shortDescription: "Red crystal swan charm bracelet, gold plated",
    category: "Bracelets",
    price: 490,
    currency: "دينار",
    displayPrice: "490 دينار",
    images: ["https://www.genspark.ai/api/files/s/U4egGAcL"],
    originalImage: "https://www.genspark.ai/api/files/s/U4egGAcL",
    inStock: true,
    quantity: 5,
    featured: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "7",
    isSet: false,
    productCodes: ["5665830"],
    brand: "SWAROVSKI",
    name: "Attract Bangle – Heart Crystals",
    nameAr: "إسورة أتراكت - كريستال قلب",
    description: "An exquisite open bangle bracelet featuring two large heart-shaped crystals at each open end, pavé set with brilliant round crystals along the entire rhodium-plated band. A romantic and luxurious piece perfect for special occasions.",
    shortDescription: "Open bangle with twin heart-cut crystal ends",
    category: "Bracelets",
    price: 620,
    currency: "دينار",
    displayPrice: "620 دينار",
    images: ["https://www.genspark.ai/api/files/s/712a54QR"],
    originalImage: "https://www.genspark.ai/api/files/s/712a54QR",
    inStock: true,
    quantity: 4,
    featured: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "8",
    isSet: false,
    productCodes: ["5614113"],
    brand: "SWAROVSKI",
    name: "Iconic Swan Earrings – Black & Pearl",
    nameAr: "أقراط سوان أيقونيك - أسود ولؤلؤ",
    description: "Dramatic and sophisticated earrings featuring jet black pavé-set crystal swans with rose gold-plated details, suspended above luminous white Swarovski pearls. A bold statement piece combining the elegance of the swan with the timeless beauty of pearls.",
    shortDescription: "Black crystal swan earrings with pearl drops",
    category: "Earrings",
    price: 580,
    currency: "دينار",
    displayPrice: "580 دينار",
    images: ["https://www.genspark.ai/api/files/s/dKGxux1b"],
    originalImage: "https://www.genspark.ai/api/files/s/dKGxux1b",
    inStock: true,
    quantity: 6,
    featured: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "9",
    isSet: false,
    productCodes: ["5647716"],
    brand: "SWAROVSKI",
    name: "Iconic Swan Necklace – Rose Gold Ombré",
    nameAr: "قلادة سوان أيقونيك - أومبريه روز غولد",
    description: "A breathtaking swan pendant necklace with a stunning ombré effect transitioning from clear white crystals at the head to warm rose gold-toned crystals at the body. Presented in a Swarovski gift box. Rhodium-plated chain. A true collector's piece.",
    shortDescription: "Rose gold ombré swan crystal pendant necklace",
    category: "Necklaces",
    price: 680,
    currency: "دينار",
    displayPrice: "680 دينار",
    images: ["https://www.genspark.ai/api/files/s/68gyxYSI"],
    originalImage: "https://www.genspark.ai/api/files/s/68gyxYSI",
    inStock: true,
    quantity: 3,
    featured: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "10",
    isSet: false,
    productCodes: ["5518865"],
    brand: "SWAROVSKI",
    name: "Infinity Necklace – Crystal",
    nameAr: "قلادة إنفينيتي - كريستال",
    description: "An elegant infinity symbol necklace with pavé-set crystals, presented with a lifestyle view showing its delicate fit. The infinity symbol is fully set with brilliant round crystals, symbolizing everlasting love and connection. Rhodium-plated chain.",
    shortDescription: "Crystal infinity symbol pendant necklace",
    category: "Necklaces",
    price: 380,
    currency: "دينار",
    displayPrice: "380 دينار",
    images: ["https://www.genspark.ai/api/files/s/6Kl8XZNb"],
    originalImage: "https://www.genspark.ai/api/files/s/6Kl8XZNb",
    inStock: true,
    quantity: 9,
    featured: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "11",
    isSet: false,
    productCodes: ["5662187"],
    brand: "SWAROVSKI",
    name: "Salford Pink Heart Earrings – Exclusive",
    nameAr: "أقراط قلب وردي - حصري سالفورد",
    description: "An exclusive Salford Libya presentation of these stunning pink heart-shaped pavé earrings with a crystal drop. Shown in our signature pink gift box with the Salford Jewelry branding. Rose gold-plated setting with blush pink crystals and a faceted crystal drop pendant.",
    shortDescription: "Pink pavé heart drop earrings in Salford gift box",
    category: "Earrings",
    price: 450,
    currency: "دينار",
    displayPrice: "450 دينار",
    images: ["https://www.genspark.ai/api/files/s/6m9DFiw3"],
    originalImage: "https://www.genspark.ai/api/files/s/6m9DFiw3",
    inStock: true,
    quantity: 5,
    featured: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "12",
    isSet: false,
    productCodes: ["5648931"],
    brand: "SWAROVSKI",
    name: "Matrix Tennis Bracelet – Yellow Gold",
    nameAr: "سوار تنس ماتريكس - ذهبي أصفر",
    description: "A classic Swarovski tennis bracelet reimagined in gold-plated setting with luminous yellow-toned crystals. Each crystal is individually set in a secure claw setting, creating a continuous line of dazzling brilliance around the wrist. Lobster clasp closure.",
    shortDescription: "Yellow crystal tennis bracelet, gold plated",
    category: "Bracelets",
    price: 750,
    currency: "دينار",
    displayPrice: "750 دينار",
    images: ["https://www.genspark.ai/api/files/s/VV7kfQC1"],
    originalImage: "https://www.genspark.ai/api/files/s/VV7kfQC1",
    inStock: true,
    quantity: 4,
    featured: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "13",
    isSet: false,
    productCodes: ["5668820"],
    brand: "SWAROVSKI",
    name: "Swan Lake Pendant Necklace – Red & Gold",
    nameAr: "قلادة سوان ليك - أحمر وذهبي",
    description: "A magnificent pendant necklace featuring a large red pavé-set swan charm suspended on a gold-plated chain adorned with luminous Swarovski pearls. The deep crimson crystals create a passionate, dramatic look. A true statement piece.",
    shortDescription: "Red crystal swan pendant with pearl-adorned gold chain",
    category: "Necklaces",
    price: 720,
    currency: "دينار",
    displayPrice: "720 دينار",
    images: ["https://www.genspark.ai/api/files/s/72VLZOnH"],
    originalImage: "https://www.genspark.ai/api/files/s/72VLZOnH",
    inStock: true,
    quantity: 3,
    featured: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "14",
    isSet: false,
    productCodes: ["5678528"],
    brand: "SWAROVSKI",
    name: "Swan Lake Necklace – White Baguette",
    nameAr: "قلادة سوان ليك - باجيت أبيض",
    description: "An extraordinary statement necklace featuring an oversized swan crafted with baguette-cut and round brilliant crystals, accented with Swarovski pearls at the swan's midsection, and a dramatic pear-shaped crystal drop. Rhodium-plated setting.",
    shortDescription: "Large baguette crystal swan with pearl & drop pendant",
    category: "Necklaces",
    price: 980,
    currency: "دينار",
    displayPrice: "980 دينار",
    images: ["https://www.genspark.ai/api/files/s/Mw8Vm2Fj"],
    originalImage: "https://www.genspark.ai/api/files/s/Mw8Vm2Fj",
    inStock: true,
    quantity: 2,
    featured: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "15",
    isSet: false,
    productCodes: ["5614106"],
    brand: "SWAROVSKI",
    name: "Iconic Swan Pendant – Pink Rose Gold",
    nameAr: "قلادة سوان أيقونيك - روز غولد وردي",
    description: "A stunning pink swan pendant necklace with rose gold-plated setting, featuring baguette-cut and round brilliant crystals forming the iconic swan silhouette with a beautiful pink pear-cut crystal as the focal point. Shown in gift box presentation.",
    shortDescription: "Pink baguette swan pendant, rose gold plated",
    category: "Necklaces",
    price: 640,
    currency: "دينار",
    displayPrice: "640 دينار",
    images: ["https://www.genspark.ai/api/files/s/4zBNSlHS"],
    originalImage: "https://www.genspark.ai/api/files/s/4zBNSlHS",
    inStock: true,
    quantity: 4,
    featured: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "16",
    isSet: false,
    productCodes: ["5678354"],
    brand: "SWAROVSKI",
    name: "Swan Lake Pendant – Pink Drop",
    nameAr: "قلادة سوان ليك - دروب وردي",
    description: "An ethereal pendant necklace featuring a graceful swan with a multi-layered crystal pendant design. A square pink crystal at the top leads to a marquise star crystal, then flows into a pavé-set swan body with a large pink pear-cut crystal wing. Rose gold-plated. Presented in gift box.",
    shortDescription: "Multi-layer pink crystal swan drop pendant",
    category: "Necklaces",
    price: 860,
    currency: "دينار",
    displayPrice: "860 دينار",
    images: ["https://www.genspark.ai/api/files/s/YAmZbQ8X"],
    originalImage: "https://www.genspark.ai/api/files/s/YAmZbQ8X",
    inStock: true,
    quantity: 3,
    featured: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "17",
    isSet: false,
    productCodes: ["5497813"],
    brand: "SWAROVSKI",
    name: "Symbolic Multi-Charm Necklace",
    nameAr: "قلادة متعددة التمائم الرمزية",
    description: "A beautifully curated charm necklace featuring an array of meaningful symbols: a crescent moon, infinity sign, Hamsa hand, evil eye, pearl drop, horseshoe, and sun, all set in rose gold-plated settings with various Swarovski crystals. Perfect for layering.",
    shortDescription: "Rose gold multi-symbol crystal charm necklace",
    category: "Necklaces",
    price: 540,
    currency: "دينار",
    displayPrice: "540 دينار",
    images: ["https://www.genspark.ai/api/files/s/GQ22P5FE"],
    originalImage: "https://www.genspark.ai/api/files/s/GQ22P5FE",
    inStock: true,
    quantity: 5,
    featured: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "18",
    isSet: false,
    productCodes: ["5518865"],
    brand: "SWAROVSKI",
    name: "Infinity Heart Necklace – Rose Gold",
    nameAr: "قلادة قلب إنفينيتي - روز غولد",
    description: "A romantic necklace combining a crystal-set infinity symbol intertwined with an open heart silhouette, both outlined in brilliant round crystals. Rose gold-plated setting. Presented in Swarovski gift box. A perfect gift symbolizing infinite love.",
    shortDescription: "Infinity & heart crystal pendant, rose gold plated",
    category: "Necklaces",
    price: 420,
    currency: "دينار",
    displayPrice: "420 دينار",
    images: ["https://www.genspark.ai/api/files/s/WAtVRVrS"],
    originalImage: "https://www.genspark.ai/api/files/s/WAtVRVrS",
    inStock: true,
    quantity: 7,
    featured: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "19",
    isSet: false,
    productCodes: ["5663493"],
    brand: "SWAROVSKI",
    name: "Iconic Swan Necklace – Blue Crystal",
    nameAr: "قلادة سوان أيقونيك - كريستال أزرق",
    description: "A striking swan pendant necklace featuring a large triangular blue crystal as the swan's body, surrounded by pavé-set round crystals and baguette feather details. Rhodium-plated setting. Presented beautifully in a Swarovski gift box.",
    shortDescription: "Blue crystal swan pendant, rhodium plated",
    category: "Necklaces",
    price: 700,
    currency: "دينار",
    displayPrice: "700 دينار",
    images: ["https://www.genspark.ai/api/files/s/OEOVOzVo"],
    originalImage: "https://www.genspark.ai/api/files/s/OEOVOzVo",
    inStock: true,
    quantity: 3,
    featured: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "20",
    isSet: false,
    productCodes: ["5723389"],
    brand: "SWAROVSKI",
    name: "Teddy Bear Pendant Necklace – Pink",
    nameAr: "قلادة دمية الدب - وردي",
    description: "An adorable and luxurious teddy bear pendant necklace featuring a fully pavé-set pink crystal bear body with a heart-shaped crystal on the chest. Rose gold-plated setting. Presented in Swarovski gift box. A charming gift for someone special.",
    shortDescription: "Pink pavé crystal teddy bear pendant necklace",
    category: "Necklaces",
    price: 500,
    currency: "دينار",
    displayPrice: "500 دينار",
    images: ["https://www.genspark.ai/api/files/s/FlfV5MUB"],
    originalImage: "https://www.genspark.ai/api/files/s/FlfV5MUB",
    inStock: true,
    quantity: 6,
    featured: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "21",
    isSet: false,
    productCodes: ["5642976"],
    brand: "SWAROVSKI",
    name: "Teddy Bear Bracelet – Blue Aqua",
    nameAr: "سوار دمية الدب - أكوا أزرق",
    description: "A playful and vibrant bracelet featuring a fully pavé-set aqua blue crystal teddy bear with signature sunglasses detail, threaded on a matching blue cord with adjustable rhodium-plated end caps. Fun, fashionable, and unmistakably Swarovski.",
    shortDescription: "Aqua blue crystal teddy bear cord bracelet",
    category: "Bracelets",
    price: 350,
    currency: "دينار",
    displayPrice: "350 دينار",
    images: ["https://www.genspark.ai/api/files/s/kqnsWEVv"],
    originalImage: "https://www.genspark.ai/api/files/s/kqnsWEVv",
    inStock: true,
    quantity: 8,
    featured: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "22",
    isSet: false,
    productCodes: ["5678346"],
    brand: "SWAROVSKI",
    name: "Swan Lake Earrings – Blue Crystal",
    nameAr: "أقراط سوان ليك - كريستال أزرق",
    description: "Spectacular hoop earrings featuring large swan charms fully pavé-set in ombre blue crystals, suspended from crystal-set hoops with a large pear-cut crystal drop. A bold, glamorous statement piece that captures the drama and elegance of the swan.",
    shortDescription: "Blue ombré swan earrings with crystal drop",
    category: "Earrings",
    price: 660,
    currency: "دينار",
    displayPrice: "660 دينار",
    images: ["https://www.genspark.ai/api/files/s/7J0MdSeS"],
    originalImage: "https://www.genspark.ai/api/files/s/7J0MdSeS",
    inStock: true,
    quantity: 4,
    featured: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "23",
    isSet: false,
    productCodes: ["5518869"],
    brand: "SWAROVSKI",
    name: "Swarovski Infinity Necklace – Rose Gold",
    nameAr: "قلادة إنفينيتي سواروفسكي - روز غولد",
    description: "A clean, modern infinity symbol necklace set entirely with brilliant round crystals in a rose gold-plated setting. Presented in Swarovski gift box. The perfect everyday luxury accessory that symbolizes endless possibilities and eternal love.",
    shortDescription: "Crystal infinity pendant, rose gold plated",
    category: "Necklaces",
    price: 360,
    currency: "دينار",
    displayPrice: "360 دينار",
    images: ["https://www.genspark.ai/api/files/s/SkFZct0P"],
    originalImage: "https://www.genspark.ai/api/files/s/SkFZct0P",
    inStock: true,
    quantity: 10,
    featured: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "24",
    isSet: false,
    productCodes: ["5614981"],
    brand: "SWAROVSKI",
    name: "Angelic Bracelet – Gold Plated",
    nameAr: "سوار أنجيليك - مطلي بالذهب",
    description: "A luxurious gold-plated bracelet featuring large oval crystals surrounded by halos of pavé round crystals, interspersed with polished gold-plated round beads. The warm gold setting perfectly complements the brilliant white crystals for a regal, timeless look.",
    shortDescription: "White crystal halo bracelet, gold plated",
    category: "Bracelets",
    price: 620,
    currency: "دينار",
    displayPrice: "620 دينار",
    images: ["https://www.genspark.ai/api/files/s/xyqBhvwA"],
    originalImage: "https://www.genspark.ai/api/files/s/xyqBhvwA",
    inStock: true,
    quantity: 5,
    featured: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "25",
    isSet: false,
    productCodes: ["5614113"],
    brand: "SWAROVSKI",
    name: "Iconic Swan Pendant – Red Crystal",
    nameAr: "قلادة سوان أيقونيك - كريستال أحمر",
    description: "An iconic swan pendant featuring a large triangular red crystal as the swan body, surrounded by pavé-set round crystals in a graceful swan silhouette. Rose gold-plated setting and chain. Timeless elegance with passionate red crystal drama.",
    shortDescription: "Red crystal swan pendant, rose gold plated",
    category: "Necklaces",
    price: 590,
    currency: "دينار",
    displayPrice: "590 دينار",
    images: ["https://www.genspark.ai/api/files/s/xJWzLu5i"],
    originalImage: "https://www.genspark.ai/api/files/s/xJWzLu5i",
    inStock: true,
    quantity: 4,
    featured: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "26",
    isSet: false,
    productCodes: ["5658398"],
    brand: "SWAROVSKI",
    name: "Teddy Bear Pendant – Aqua Blue",
    nameAr: "قلادة دمية الدب - أكوا أزرق",
    description: "A charming teddy bear pendant necklace featuring a fully pavé-set aqua/mint crystal bear wearing sunglasses, suspended on a rhodium-plated paperclip chain. Fun and fashionable, this whimsical piece adds a playful touch to any outfit.",
    shortDescription: "Aqua crystal teddy bear with sunglasses pendant",
    category: "Necklaces",
    price: 440,
    currency: "دينار",
    displayPrice: "440 دينار",
    images: ["https://www.genspark.ai/api/files/s/h6SxLsu7"],
    originalImage: "https://www.genspark.ai/api/files/s/h6SxLsu7",
    inStock: true,
    quantity: 6,
    featured: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "27",
    isSet: false,
    productCodes: ["5647999"],
    brand: "SWAROVSKI",
    name: "Tennis Deluxe Bracelet – Rhodium",
    nameAr: "سوار تنس ديلوكس - رودينيوم",
    description: "The ultimate Swarovski tennis bracelet featuring a continuous row of brilliant round crystals in a secure four-prong setting. Shown with lifestyle and studio photography. Classic, timeless design that pairs with everything from casual to formal. Rhodium-plated.",
    shortDescription: "Classic round crystal tennis bracelet, rhodium",
    category: "Bracelets",
    price: 680,
    currency: "دينار",
    displayPrice: "680 دينار",
    images: ["https://www.genspark.ai/api/files/s/el9bc52j"],
    originalImage: "https://www.genspark.ai/api/files/s/el9bc52j",
    inStock: true,
    quantity: 7,
    featured: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "28",
    isSet: false,
    productCodes: ["5678341"],
    brand: "SWAROVSKI",
    name: "Swan Lake Earrings – Pink Crystal",
    nameAr: "أقراط سوان ليك - كريستال وردي",
    description: "Breathtaking large swan earrings fully pavé-set with vibrant pink crystals and pink enamel detailing, suspended from crystal-set rose gold-plated hoop earrings. A bold, glamorous statement piece for those who love to make an entrance.",
    shortDescription: "Large pink pavé swan drop earrings, rose gold",
    category: "Earrings",
    price: 740,
    currency: "دينار",
    displayPrice: "740 دينار",
    images: ["https://www.genspark.ai/api/files/s/YM1Ty6F3"],
    originalImage: "https://www.genspark.ai/api/files/s/YM1Ty6F3",
    inStock: true,
    quantity: 3,
    featured: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  // SETS
  {
    id: "101",
    isSet: true,
    productCodes: ["5647946", "5496080"],
    brand: "SWAROVSKI",
    name: "Swan Iconic Set – Pink Earrings & Pearl Necklace",
    nameAr: "طقم سوان أيقونيك - أقراط وردية وقلادة لؤلؤ",
    description: "**Iconic Swan Earrings – Pink Gradient:**\nElegant swan stud earrings adorned with beautiful pink-to-white gradient crystals.\n\n**Swan Iconic Pendant Necklace – White Pearl:**\nA timeless swan pendant necklace adorned with gleaming white crystals and pearl accents.",
    shortDescription: "Pink swan earrings + pearl swan necklace set",
    category: "Sets",
    subCategory: "Necklace & Earrings Set",
    price: 850,
    currency: "دينار",
    displayPrice: "850 دينار",
    individualPrices: [420, 560],
    savings: 130,
    images: [
      "https://www.genspark.ai/api/files/s/X9PzkTE4",
      "https://www.genspark.ai/api/files/s/0WelYyel"
    ],
    originalImage: "",
    inStock: true,
    quantity: 3,
    featured: true,
    setComponents: [
      { productCode: "5647946", name: "Iconic Swan Earrings – Pink Gradient", individualPrice: 420, images: ["https://www.genspark.ai/api/files/s/X9PzkTE4"] },
      { productCode: "5496080", name: "Swan Iconic Pendant Necklace – White Pearl", individualPrice: 560, images: ["https://www.genspark.ai/api/files/s/0WelYyel"] }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "102",
    isSet: true,
    productCodes: ["5614113", "5534847"],
    brand: "SWAROVSKI",
    name: "Black Swan Elegance Set – Earrings & Bracelet",
    nameAr: "طقم البجعة السوداء - أقراط وسوار",
    description: "**Iconic Swan Earrings – Black & Pearl:**\nDramatic black pavé crystal swans with rose gold details suspended above luminous white pearls.\n\n**Iconic Swan Bracelet – Red & Gold:**\nBold dual-strand bracelet with red pavé swan charm and gold-plated chain.",
    shortDescription: "Black swan pearl earrings + red swan charm bracelet",
    category: "Sets",
    subCategory: "Earrings & Bracelet Set",
    price: 950,
    currency: "دينار",
    displayPrice: "950 دينار",
    individualPrices: [580, 490],
    savings: 120,
    images: [
      "https://www.genspark.ai/api/files/s/dKGxux1b",
      "https://www.genspark.ai/api/files/s/U4egGAcL"
    ],
    originalImage: "",
    inStock: true,
    quantity: 2,
    featured: true,
    setComponents: [
      { productCode: "5614113", name: "Iconic Swan Earrings – Black & Pearl", individualPrice: 580, images: ["https://www.genspark.ai/api/files/s/dKGxux1b"] },
      { productCode: "5534847", name: "Iconic Swan Bracelet – Red & Gold", individualPrice: 490, images: ["https://www.genspark.ai/api/files/s/U4egGAcL"] }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "103",
    isSet: true,
    productCodes: ["5647716", "5647946", "5688498"],
    brand: "SWAROVSKI",
    name: "Rose Swan Complete Set – Necklace, Earrings & Bracelet",
    nameAr: "طقم البجعة الوردية الكامل - قلادة وأقراط وسوار",
    description: "**Iconic Swan Necklace – Rose Gold Ombré:**\nBreathtaking rose gold ombré swan pendant.\n\n**Iconic Swan Earrings – Pink Gradient:**\nMatching pink gradient crystal swan studs.\n\n**Angelic Bracelet – Rhodium Plated:**\nCrystal cluster bracelet to complete the set.",
    shortDescription: "Rose gold swan necklace + pink earrings + crystal bracelet",
    category: "Sets",
    subCategory: "Full Jewelry Set",
    price: 1450,
    currency: "دينار",
    displayPrice: "1450 دينار",
    individualPrices: [680, 420, 550],
    savings: 200,
    images: [
      "https://www.genspark.ai/api/files/s/68gyxYSI",
      "https://www.genspark.ai/api/files/s/X9PzkTE4",
      "https://www.genspark.ai/api/files/s/kDmmhajD"
    ],
    originalImage: "",
    inStock: true,
    quantity: 2,
    featured: true,
    setComponents: [
      { productCode: "5647716", name: "Iconic Swan Necklace – Rose Gold Ombré", individualPrice: 680, images: ["https://www.genspark.ai/api/files/s/68gyxYSI"] },
      { productCode: "5647946", name: "Iconic Swan Earrings – Pink Gradient", individualPrice: 420, images: ["https://www.genspark.ai/api/files/s/X9PzkTE4"] },
      { productCode: "5688498", name: "Angelic Bracelet – Rhodium Plated", individualPrice: 550, images: ["https://www.genspark.ai/api/files/s/kDmmhajD"] }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// In-memory store
let products: Product[] = [...sampleProducts];
let settings: SiteSettings = { ...defaultSettings };
let nextId = 200;

export function getAllProducts(): Product[] { return products; }
export function getProductById(id: string): Product | undefined { return products.find(p => p.id === id); }
export function getFeaturedProducts(): Product[] { return products.filter(p => p.featured && p.inStock); }
export function getProductsByCategory(category: string): Product[] { return products.filter(p => p.category === category); }
export function getSets(): Product[] { return products.filter(p => p.isSet); }
export function getIndividualProducts(): Product[] { return products.filter(p => !p.isSet); }
export function searchProducts(query: string): Product[] {
  const q = query.toLowerCase();
  return products.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.nameAr.includes(q) ||
    p.productCodes.some(code => code.toLowerCase().includes(q)) ||
    p.category.toLowerCase().includes(q)
  );
}
export function getCategories(): string[] { return [...new Set(products.filter(p=>!p.isSet).map(p => p.category))]; }
export function addProduct(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Product {
  const newProduct: Product = { ...product, id: String(nextId++), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  products.push(newProduct);
  return newProduct;
}
export function updateProduct(id: string, updates: Partial<Product>): Product | null {
  const idx = products.findIndex(p => p.id === id);
  if (idx === -1) return null;
  products[idx] = { ...products[idx], ...updates, updatedAt: new Date().toISOString() };
  return products[idx];
}
export function deleteProduct(id: string): boolean {
  const idx = products.findIndex(p => p.id === id);
  if (idx === -1) return false;
  products.splice(idx, 1);
  return true;
}
export function getSettings(): SiteSettings { return settings; }
export function updateSettings(updates: Partial<SiteSettings>): SiteSettings {
  settings = { ...settings, ...updates };
  return settings;
}
export function parseFilename(filename: string): { isSet: boolean; productCodes: string[]; price: number; brand: string } | null {
  const regex = /SWAROVSKI-([^()]+)\((\d+)\s*(?:دينار|LYD)\)/i;
  const match = filename.match(regex);
  if (!match) return null;
  const codesString = match[1].trim();
  const isSet = codesString.includes('+');
  const productCodes = isSet ? codesString.split('+').map(c => c.trim()) : [codesString];
  return { brand: "SWAROVSKI", isSet, productCodes, price: parseInt(match[2]) };
}
