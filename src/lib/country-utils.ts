const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  'Albania': 'AL', 'American Samoa': 'AS', 'Andorra': 'AD', 'Antarctica': 'AQ',
  'Antigua and Barbuda': 'AG', 'Argentina': 'AR', 'Armenia': 'AM', 'Australia': 'AU',
  'Austria': 'AT', 'Belgium': 'BE', 'Belize': 'BZ', 'Bolivia': 'BO', 'Brazil': 'BR',
  'Brunei': 'BN', 'Burundi': 'BI', 'Cambodia': 'KH', 'Canada': 'CA', 'Chad': 'TD',
  'Chile': 'CL', 'China': 'CN', 'Colombia': 'CO', 'Costa Rica': 'CR', 'Croatia': 'HR',
  'Cuba': 'CU', 'Cyprus': 'CY', 'DR Congo': 'CD', 'Denmark': 'DK',
  'Dominican Republic': 'DO', 'Ecuador': 'EC', 'El Salvador': 'SV', 'England': 'GB',
  'Faroe Islands': 'FO', 'Finland': 'FI', 'France': 'FR', 'Georgia': 'GE',
  'Germany': 'DE', 'Gibraltar': 'GI', 'Greece': 'GR', 'Guadeloupe': 'GP',
  'Guatemala': 'GT', 'Heard Island and McDonald Islands': 'HM', 'Honduras': 'HN',
  'Hong Kong': 'HK', 'Iceland': 'IS', 'India': 'IN', 'Iraq': 'IQ', 'Ireland': 'IE',
  'Isle of Man': 'IM', 'Israel': 'IL', 'Italy': 'IT', 'Jamaica': 'JM', 'Japan': 'JP',
  'Jersey': 'JE', 'Kazakhstan': 'KZ', 'Kuwait': 'KW', 'Latvia': 'LV', 'Lebanon': 'LB',
  'Luxembourg': 'LU', 'Madagascar': 'MG', 'Malawi': 'MW', 'Malaysia': 'MY',
  'Martinique': 'MQ', 'Mexico': 'MX', 'Micronesia': 'FM', 'Monaco': 'MC',
  'Mongolia': 'MN', 'Morocco': 'MA', 'Nepal': 'NP', 'Netherlands': 'NL',
  'New Caledonia': 'NC', 'New Zealand': 'NZ', 'Nicaragua': 'NI', 'Niger': 'NE',
  'Nigeria': 'NG', 'North Korea': 'KP', 'Northern Mariana Islands': 'MP',
  'Norway': 'NO', 'Oman': 'OM', 'Palestine': 'PS', 'Panama': 'PA', 'Peru': 'PE',
  'Philippines': 'PH', 'Portugal': 'PT', 'Puerto Rico': 'PR', 'Qatar': 'QA',
  'Romania': 'RO', 'Russia': 'RU', 'Saint Lucia': 'LC',
  'Saint Pierre and Miquelon': 'PM', 'Saudi Arabia': 'SA', 'Scotland': 'GB',
  'Senegal': 'SN', 'Serbia': 'RS', 'Singapore': 'SG', 'South Korea': 'KR',
  'Spain': 'ES', 'Sri Lanka': 'LK', 'Sweden': 'SE', 'Switzerland': 'CH',
  'Taiwan': 'TW', 'Thailand': 'TH', 'Togo': 'TG', 'Tunisia': 'TN', 'Turkey': 'TR',
  'Ukraine': 'UA', 'United Arab Emirates': 'AE', 'United Kingdom': 'GB',
  'United States': 'US', 'United States Minor Outlying Islands': 'UM',
  'United States Virgin Islands': 'VI', 'Venezuela': 'VE', 'Vietnam': 'VN',
  'Wales': 'GB', 'Wallis and Futuna': 'WF', 'Zimbabwe': 'ZW',
}

function resolveCountryCode(cc: string): string | null {
  if (/^[A-Za-z]{2}$/.test(cc)) return cc.toUpperCase()
  return COUNTRY_NAME_TO_CODE[cc] ?? null
}

export function countryCodeToFlag(cc: string): string | null {
  const code = resolveCountryCode(cc)
  if (!code) return null
  const codePoints = [...code].map(
    (c) => 0x1f1e6 + c.charCodeAt(0) - 65,
  )
  return String.fromCodePoint(...codePoints)
}
