export type StrategicSkill = {
  profession: string;
  pathway: string;
  name: string;
  icon: string;
  cooldown: string;
  tags: string[];
  summary: string;
  ranks: string[];
  source: '11.12 更新' | '游戏内截图';
};

export const STRATEGIC_SKILLS: StrategicSkill[] = [
  {
    profession: '战士',
    pathway: '黄昏巨人途径',
    name: '黄昏领域',
    icon: '/strategic-skills/twilight-domain.png',
    cooldown: '120 秒',
    tags: ['群体', '持续', '弱控'],
    summary:
      '展开跟随自身移动的黄昏领域，使范围内至多 6 名敌方持续滞涩，领域持续 6 秒；展开时将范围内距离最远的至多 4 名敌方拉至自身身前。',
    ranks: [
      '半径增加 4 米，滞涩影响人数增加 2 人。',
      '持续时间增加 2 秒。',
      '展开领域时，对范围内至多 8 名敌方以 100% 概率附加 25% 减速，持续 4 秒。',
      '释放领域时自身获得 4 秒霸体。',
    ],
    source: '11.12 更新',
  },
  {
    profession: '窥秘人',
    pathway: '隐者途径',
    name: '真知之眼',
    icon: '/strategic-skills/eye-of-truth.png',
    cooldown: '120 秒',
    tags: ['群体', '辅助', '抗控'],
    summary:
      '为自身及周围 6 米内最多 5 名友方附加真知之眼：持续期间免疫拖拽，且移动速度不会低于自身基础移动速度的 100%，持续 4 秒。',
    ranks: [
      '持续时间增加 2 秒。',
      '作用半径增加 2 米；目标额外获得 25% 加速，持续 10 秒。',
      '解除目标身上的滞涩，且持续期间免疫滞涩。',
      '最低移动速度提高到基础移动速度的 125%，额外加速提高到 50%。',
    ],
    source: '11.12 更新',
  },
  {
    profession: '占卜家',
    pathway: '愚者途径',
    name: '傀儡提线',
    icon: '/strategic-skills/marionette-strings.png',
    cooldown: '70 秒',
    tags: ['单体', '强控'],
    summary:
      '对 15 米内单体目标施放：使目标在 3.5 秒后变为傀儡并向自己走来，持续 2 秒，无法解控或以霸体抵挡；目标距施法者超过 20 米时立刻生效。释放瞬间向其周围最多 3 名敌方连线，距目标超过 15 米可拉断，否则 3.5 秒后眩晕 1 秒。',
    ranks: [
      '控制效果的生效延迟减少 1 秒。',
      '被连线的敌人减速 25%，持续 4 秒。',
      '施法距离增加 4 米。',
      '操控持续时间提高到 2.5 秒，连线眩晕提高到 1.5 秒。',
    ],
    source: '11.12 更新',
  },
  {
    profession: '歌颂者',
    pathway: '太阳途径',
    name: '勇气赞歌',
    icon: '/strategic-skills/song-of-courage.png',
    cooldown: '120 秒',
    tags: ['群体', '辅助', '净化'],
    summary:
      '赋予 8 米内至多 6 名友方净化能力，持续 4 秒。拥有勇气赞歌的成员击败敌方后，短时间后净化目标，每名成员最多生效 2 次。',
    ranks: [
      '生效范围增加 4 米，影响人数增加 2 人。',
      '持续时间增加 2 秒，生效次数增加 1 次。',
      '受影响的友方提高暴击。',
      '勇气之歌结束时，范围内部分友方获得加速和增伤。',
    ],
    source: '11.12 更新',
  },
  {
    profession: '观众',
    pathway: '空想家途径',
    name: '心灵灯塔',
    icon: '/strategic-skills/mind-beacon.png',
    cooldown: '120 秒',
    tags: ['群体', '辅助', '净化免疫'],
    summary: '展开持续 4 秒的心灵灯塔，使自身周围 8 米内至多 6 名友方免疫净化，优先小队成员。',
    ranks: [
      '持续时间增加 2 秒。',
      '半径增加 4 米，影响人数增加 2 人。',
      '受影响的友方获得 5% 减伤。',
      '受影响的友方即将被击败时获得 3 秒无敌；期间重伤 80%，且增伤降低 30%。每名玩家独立冷却 120 秒。',
    ],
    source: '游戏内截图',
  },
  {
    profession: '学徒',
    pathway: '门途径',
    name: '传送之门',
    icon: '/strategic-skills/teleport-door.png',
    cooldown: '300 秒',
    tags: ['团队', '传送'],
    summary:
      '在 20 米内选择目标位置，在身前和目标位置各生成一扇持续 25 秒的传送之门，团队成员可交互传送；每扇门至多由每名成员使用 1 次。',
    ranks: [
      '最远放置距离提高到 30 米。',
      '冷却时间缩短 30 秒。',
      '团队成员使用后获得 25% 加速与 5% 减伤，持续 5 秒。',
      '释放后召集团队成员传送至自身位置，至多 6 人；被召集成员 240 秒内不能再次被召集。',
    ],
    source: '游戏内截图',
  },
];
