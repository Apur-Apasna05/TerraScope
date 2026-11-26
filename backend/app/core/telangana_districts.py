"""
Official Telangana 33 Districts Registry and LGD Code Dictionary.
Sources:
- Ministry of Panchayati Raj / Local Government Directory (LGD), Government of India
- Survey of India / DataMeet Telangana Administrative Boundaries (EPSG:4326)
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import Optional, Dict, Any, List


@dataclass(frozen=True)
class TelanganaDistrictMeta:
    dist_lgd: int
    dtname: str
    stname: str
    lat: float
    lon: float
    area_km2: float
    aliases: tuple[str, ...] = ()


OFFICIAL_TELANGANA_DISTRICTS: Dict[int, TelanganaDistrictMeta] = {
    501: TelanganaDistrictMeta(501, "Adilabad", "Telangana", 19.6641, 78.5320, 4153.0, ("adilabad",)),
    690: TelanganaDistrictMeta(690, "Bhadradri Kothagudem", "Telangana", 17.5540, 80.6171, 7483.0, ("bhadradri kothagudem", "kothagudem", "bhadradri")),
    507: TelanganaDistrictMeta(507, "Hyderabad", "Telangana", 17.3850, 78.4867, 217.0, ("hyderabad",)),
    681: TelanganaDistrictMeta(681, "Jagitial", "Telangana", 18.7915, 78.9128, 2419.0, ("jagitial", "jagityal")),
    689: TelanganaDistrictMeta(689, "Jangoan", "Telangana", 17.7275, 79.1798, 2188.0, ("jangoan", "jangaon")),
    687: TelanganaDistrictMeta(687, "Jayashankar", "Telangana", 18.4386, 79.8000, 2293.0, ("jayashankar", "jayashankar bhupalpally", "bhupalpally")),
    695: TelanganaDistrictMeta(695, "Jogulamba Gadwal", "Telangana", 16.2340, 77.8077, 2928.0, ("jogulamba gadwal", "gadwal")),
    685: TelanganaDistrictMeta(685, "Kamareddy", "Telangana", 18.3228, 78.3378, 3652.0, ("kamareddy",)),
    508: TelanganaDistrictMeta(508, "Karimnagar", "Telangana", 18.4386, 79.1288, 2128.0, ("karimnagar",)),
    509: TelanganaDistrictMeta(509, "Khammam", "Telangana", 17.2472, 80.1514, 4361.0, ("khammam",)),
    699: TelanganaDistrictMeta(699, "Kumuram Bheem Asifabad", "Telangana", 19.3600, 79.2900, 4878.0, ("kumuram bheem asifabad", "asifabad", "komaram bheem")),
    688: TelanganaDistrictMeta(688, "Mahabubabad", "Telangana", 17.5986, 80.0028, 2877.0, ("mahabubabad",)),
    512: TelanganaDistrictMeta(512, "Mahabubnagar", "Telangana", 16.7488, 77.9856, 2738.0, ("mahabubnagar",)),
    684: TelanganaDistrictMeta(684, "Mancherial", "Telangana", 18.8679, 79.4639, 4016.0, ("mancherial",)),
    513: TelanganaDistrictMeta(513, "Medak", "Telangana", 18.0450, 78.2600, 2786.0, ("medak",)),
    700: TelanganaDistrictMeta(700, "Medchal Malkajgiri", "Telangana", 17.6297, 78.5807, 1084.0, ("medchal malkajgiri", "medchal", "malkajgiri")),
    720: TelanganaDistrictMeta(720, "Mulugu", "Telangana", 18.1925, 79.9372, 3881.0, ("mulugu",)),
    694: TelanganaDistrictMeta(694, "Nagarkurnool", "Telangana", 16.4856, 78.3328, 6545.0, ("nagarkurnool",)),
    514: TelanganaDistrictMeta(514, "Nalgonda", "Telangana", 17.0500, 79.2667, 7122.0, ("nalgonda",)),
    721: TelanganaDistrictMeta(721, "Narayanpet", "Telangana", 16.7300, 77.4900, 2336.0, ("narayanpet",)),
    680: TelanganaDistrictMeta(680, "Nirmal", "Telangana", 19.0964, 78.3439, 3845.0, ("nirmal",)),
    516: TelanganaDistrictMeta(516, "Nizamabad", "Telangana", 18.6725, 78.0941, 4288.0, ("nizamabad",)),
    682: TelanganaDistrictMeta(682, "Peddapalli", "Telangana", 18.6167, 79.3833, 2236.0, ("peddapalli",)),
    683: TelanganaDistrictMeta(683, "Rajanna Sircilla", "Telangana", 18.3833, 78.8333, 2019.0, ("rajanna sircilla", "sircilla")),
    518: TelanganaDistrictMeta(518, "Ranga Reddy", "Telangana", 17.3000, 78.4000, 5031.0, ("ranga reddy", "rangareddy")),
    691: TelanganaDistrictMeta(691, "Sangareddy", "Telangana", 17.6194, 78.0814, 4403.0, ("sangareddy",)),
    692: TelanganaDistrictMeta(692, "Siddipet", "Telangana", 18.1017, 78.8520, 3632.0, ("siddipet",)),
    696: TelanganaDistrictMeta(696, "Suryapet", "Telangana", 17.1400, 79.6200, 3607.0, ("suryapet",)),
    698: TelanganaDistrictMeta(698, "Vikarabad", "Telangana", 17.3364, 77.9047, 3386.0, ("vikarabad",)),
    693: TelanganaDistrictMeta(693, "Wanaparthy", "Telangana", 16.3622, 78.0628, 2152.0, ("wanaparthy",)),
    522: TelanganaDistrictMeta(522, "Warangal Rural", "Telangana", 17.9200, 79.7466, 2175.0, ("warangal rural", "warangal")),
    686: TelanganaDistrictMeta(686, "Warangal Urban", "Telangana", 18.0000, 79.5800, 1309.0, ("warangal urban", "hanamkonda")),
    697: TelanganaDistrictMeta(697, "Yadadri Bhuvanagiri", "Telangana", 17.5108, 78.8872, 3091.0, ("yadadri bhuvanagiri", "bhuvanagiri", "yadadri")),
}

NAME_TO_LGD: Dict[str, int] = {}
for lgd, meta in OFFICIAL_TELANGANA_DISTRICTS.items():
    NAME_TO_LGD[meta.dtname.lower()] = lgd
    for alias in meta.aliases:
        if alias not in NAME_TO_LGD:
            NAME_TO_LGD[alias] = lgd


def resolve_district_lgd(identifier: Any) -> Optional[int]:
    """
    Resolves any district identifier (integer LGD code, string LGD, official name, or alias)
    to its official Telangana District LGD code. Returns None if unresolvable.
    """
    if identifier is None:
        return None
    if isinstance(identifier, int):
        return identifier if identifier in OFFICIAL_TELANGANA_DISTRICTS else None
    
    clean_id = str(identifier).strip()
    if clean_id.isdigit():
        code = int(clean_id)
        if code in OFFICIAL_TELANGANA_DISTRICTS:
            return code

    clean_name = clean_id.lower()
    return NAME_TO_LGD.get(clean_name)


def get_district_by_lgd(lgd: int) -> Optional[TelanganaDistrictMeta]:
    return OFFICIAL_TELANGANA_DISTRICTS.get(lgd)
