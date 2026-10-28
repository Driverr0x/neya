import { NgModule } from '@angular/core';
import { QuestionnairePageRoutingModule } from './questionnaire-routing.module';
import { QuestionnairePage } from './questionnaire.page';

@NgModule({
  imports: [QuestionnairePage, QuestionnairePageRoutingModule],
})
export class QuestionnairePageModule {}
