# 화투 에셋

`public/cards/*.svg` 51개(기본 48, 보너스 2, 뒷면 1)는 이 프로젝트를 위해 직접 제작한 SVG. 생성 소스는 `scripts/generate-cards.mjs`. 기존 제조사나 게임 스크린샷의 벡터화/복사가 아니다. 광의 光, 홍단/청단, 월별 식물·동물, 쌍피 표시를 포함한다. 작은 화면의 식별을 돕는 월 표식은 보조 정보이며 카드 그림을 대체하지 않는다.

2026-10-02 조사:

- [nojhan/hanafuda](https://github.com/nojhan/hanafuda): 일본 화찰용 12개 SVG. 한국 11월 오동/12월 비 구성과 바로 맞지 않고 이동된 저장소의 라이선스 확인 필요.
- [C-W-Z/hanafuda](https://github.com/C-W-Z/hanafuda): 그림 CC BY-SA 4.0. 한국식 광/홍단·청단과 월 구성에 수정 필요.
- [Wikimedia SVG Hanafuda](https://commons.wikimedia.org/wiki/Category:SVG_Hanafuda): 이미지별 라이선스 상이. 범용 permissive 한국 화투 50장 완성 세트를 확인하지 못했다.

따라서 외부 에셋을 가져오지 않고 독자 제작을 선택했다. SVG는 전통 모티프를 단순화했으므로 실제 한국 화투 사용자와 시인성 비교 QA가 추가로 필요하다. 소리는 Web Audio로 생성한 짧은 잡음이며 외부 게임 사운드를 사용하지 않는다.
