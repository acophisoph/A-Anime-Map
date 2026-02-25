export const QueryMediaList = `query QueryMediaList($page:Int,$perPage:Int,$type:MediaType,$sort:[MediaSort]) {
  Page(page:$page, perPage:$perPage) {
    pageInfo { currentPage hasNextPage lastPage total perPage }
    media(type:$type, sort:$sort) {
      id type format seasonYear popularity averageScore
      title { romaji english native }
      coverImage { large color }
      genres
      tags { id name category rank isAdult }
      studios { nodes { id name isAnimationStudio } }
      relations {
        edges { relationType(version:2) }
        nodes { id type format seasonYear title { romaji english native } }
      }
    }
  }
}`;

export const QueryMediaStaff = `query QueryMediaStaff($id:Int,$page:Int,$perPage:Int) {
  Media(id:$id) {
    id
    staff(page:$page, perPage:$perPage) {
      pageInfo { currentPage hasNextPage lastPage total perPage }
      edges {
        role
        node {
          id
          name { full native }
          languageV2
          image { large }
          siteUrl
        }
      }
    }
  }
}`;

export const QueryMediaCharacters = `query QueryMediaCharacters($id:Int,$page:Int,$perPage:Int) {
  Media(id:$id) {
    id
    characters(page:$page, perPage:$perPage) {
      pageInfo { currentPage hasNextPage lastPage total perPage }
      edges {
        role
        node { id name { full native } image { large } siteUrl }
        voiceActors(language: JAPANESE) {
          id
          name { full native }
          languageV2
          image { large }
          siteUrl
        }
      }
    }
  }
}`;
