<script setup>
import StudyCard from './Card.vue'
</script>

<template>
  <div class="topicCardsContainer">
    <div class="listCardContainer">
      <StudyCard v-for="(card, index) in cards" :key="index" :name="card.title" :contents="card.studyTitle" :routeProfile="card.routeProfile" />
    </div>
  </div>
</template>

<script>
  export default {
    data() {
      return {
        cards: [
          {
            title: 'U. San Buenaventura',
            studyTitle: ["Mechatronics Engineering"],
            routeProfile: [],
          },
          {
            title: 'Sena',
            studyTitle: ['Software Programming', 'Industrial Automation'],
            routeProfile: [],
          },
          {
            title: 'Courses',
            studyTitle: ['Coursera', 'Platzi'],
            routeProfile: ['/','https://platzi.com/p/Daivvdiz/'],
          },
        ]
      }
    }
  };
</script>